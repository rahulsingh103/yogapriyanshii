import crypto from 'crypto';
import type { Row, Transaction } from '@libsql/client';
import { getDb, withWriteTx } from './db.js';
import { formatDubaiWhen, toSessionView, type SessionView } from './schedule.js';
import { getSettings } from './settings.js';
import { newBookingToken, normalizeBookingToken } from './tokens.js';
import {
  HttpError,
  bad,
  cleanText,
  isRestDayId,
  isSessionId,
  normalizeEmail,
  oneOf,
  PAYMENT_METHODS,
  PLAN_KEYS,
  type PaymentMethod,
  type PlanKey,
} from './validate.js';
import { sendBookingAlert, sendBookingConfirmation, sendCancellationAlert, type EmailRecord } from './email.js';

/** Prices are decided here, never by the browser. */
export const PLAN_PRICES: Record<Exclude<PlanKey, 'free'>, { amountAed: number; credits: number; validMonths: number | null }> = {
  single: { amountAed: 350, credits: 1, validMonths: null },
  pack10: { amountAed: 3000, credits: 10, validMonths: 3 },
  pack20: { amountAed: 5600, credits: 20, validMonths: 6 },
};

export const FREE_CANCEL_HOURS = 6;
const NOT_FOUND = 'No booking found for this reference. Please check the token and try again.';

/** 6 hours' notice or more refunds the credit (and gives a free class back); less burns it. */
export function cancellationOutcome(startUtcMs: number, nowMs: number): { creditStatus: 'refunded' | 'burned'; noticeHours: number } {
  const noticeHours = (startUtcMs - nowMs) / (60 * 60 * 1000);
  return { creditStatus: noticeHours >= FREE_CANCEL_HOURS ? 'refunded' : 'burned', noticeHours };
}

export type PaymentStatus = 'free' | 'pending' | 'pending_at_studio' | 'paid';

/** Same shape as `Booking` in src/types/index.ts. */
export interface BookingView {
  id: string;
  bookingToken: string;
  sessionId: string;
  sessionTitle: string;
  sessionTimeDubai: string;
  customerEmail: string;
  customerName: string;
  mode: 'in_person' | 'online';
  planKey: string;
  amountAed: number;
  paymentMethod: string;
  paymentStatus: PaymentStatus;
  status: 'confirmed' | 'cancelled';
  creditStatus: 'used' | 'refunded' | 'burned';
  bookedAt: string;
  cancelledAt?: string;
}

const BOOKING_SELECT =
  'SELECT b.id, b.token, b.session_id, b.plan_key, b.mode, b.status, b.credit_status, b.booked_at, b.cancelled_at, ' +
  'b.customer_id, b.order_id, cu.email, cu.full_name, o.amount_aed, o.payment_method, o.payment_status, ' +
  's.id AS s_id, s.class_id, s.start_utc, s.capacity, s.booked_count, s.status AS session_status, ' +
  'c.name AS class_name, c.style, c.level, c.duration_min ' +
  'FROM bookings b JOIN customers cu ON cu.id = b.customer_id JOIN sessions s ON s.id = b.session_id ' +
  'JOIN classes c ON c.id = s.class_id LEFT JOIN orders o ON o.id = b.order_id';

export function toBookingView(r: Row): BookingView {
  const isFree = String(r.plan_key) === 'free';
  return {
    id: String(r.id),
    bookingToken: String(r.token),
    sessionId: String(r.session_id),
    sessionTitle: String(r.class_name),
    sessionTimeDubai: formatDubaiWhen(String(r.start_utc)),
    customerEmail: String(r.email),
    customerName: String(r.full_name),
    mode: String(r.mode) as BookingView['mode'],
    planKey: String(r.plan_key),
    amountAed: isFree ? 0 : Number(r.amount_aed ?? 0),
    paymentMethod: isFree ? 'complimentary' : String(r.payment_method ?? ''),
    paymentStatus: isFree ? 'free' : (String(r.payment_status ?? 'pending') as PaymentStatus),
    status: String(r.status) as BookingView['status'],
    creditStatus: String(r.credit_status) as BookingView['creditStatus'],
    bookedAt: String(r.booked_at),
    ...(r.cancelled_at ? { cancelledAt: String(r.cancelled_at) } : {}),
  };
}

function sessionFromBookingRow(r: Row): SessionView {
  return toSessionView({
    id: r.s_id,
    class_id: r.class_id,
    start_utc: r.start_utc,
    capacity: r.capacity,
    booked_count: r.booked_count,
    session_status: r.session_status,
    class_name: r.class_name,
    style: r.style,
    level: r.level,
    duration_min: r.duration_min,
  } as unknown as Row);
}

async function bookingByToken(tx: Transaction | null, token: string): Promise<Row | undefined> {
  const exec = tx ?? (await getDb());
  const rs = await exec.execute({ sql: BOOKING_SELECT + ' WHERE b.token = ? LIMIT 1', args: [token] });
  return rs.rows[0];
}

function rebookBlockedMessage(studioEmail: string): string {
  const base = "I'm so sorry — for any further queries please contact the YogaPriyanshi studio directly";
  return studioEmail ? `${base} at ${studioEmail}.` : `${base}.`;
}

function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null;
  return /UNIQUE constraint failed: bookings\.customer_id, bookings\.session_id/.test(`${e?.message ?? ''}`) ||
    (/SQLITE_CONSTRAINT/.test(`${e?.code ?? ''}`) && /bookings\.customer_id/.test(`${e?.message ?? ''}`));
}

export interface CreateBookingResult {
  success: true;
  booking: BookingView;
  session: SessionView;
  message: string;
  dispatchedEmails: EmailRecord[];
}

export async function createBooking(body: Record<string, unknown>): Promise<CreateBookingResult> {
  // 1. Validate
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
  const fullName = cleanText(body.fullName, 100, { singleLine: true });
  const rawEmail = typeof body.email === 'string' ? body.email : '';
  const mode = oneOf(body.mode, ['in_person', 'online'] as const);
  if (!sessionId || !fullName || !rawEmail.trim() || !mode) {
    throw bad('Please provide all required fields: name, email, and mode.');
  }
  const email = normalizeEmail(rawEmail);
  if (!email) throw bad('Please provide a valid email address.');
  const planKey: PlanKey | null = body.planKey === undefined || body.planKey === '' ? 'free' : oneOf(body.planKey, PLAN_KEYS);
  if (!planKey) throw bad('Please choose a valid plan.');
  let paymentMethod: PaymentMethod | null = null;
  if (planKey !== 'free') {
    paymentMethod = oneOf(body.paymentMethod ?? 'studio', PAYMENT_METHODS);
    if (!paymentMethod) throw bad('Paid classes are settled at the studio for now. Please choose "Pay at Studio".');
  }
  if (isRestDayId(sessionId)) throw bad('Friday is a studio rest day. No classes are scheduled.');
  if (!isSessionId(sessionId)) throw new HttpError(404, 'Selected class session was not found.');

  const settings = await getSettings();
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const token = newBookingToken();
  const bookingId = crypto.randomUUID();

  await withWriteTx(async (tx) => {
    // 2. Session exists and hasn't started
    const srs = await tx.execute({
      sql: "SELECT id, start_utc, status FROM sessions WHERE id = ? LIMIT 1",
      args: [sessionId],
    });
    const s = srs.rows[0];
    if (!s || String(s.status) !== 'scheduled') throw new HttpError(404, 'Selected class session was not found.');
    if (new Date(String(s.start_utc)).getTime() <= now) {
      throw bad('Cannot book a session that has already started or passed.');
    }

    // 3. Find or create the customer. The first name given for an email stands; a later booking
    // can't rename the customer. (The no-op update makes RETURNING work on conflict.)
    const crs = await tx.execute({
      sql:
        'INSERT INTO customers (id, email, full_name, created_at) VALUES (?, ?, ?, ?) ' +
        'ON CONFLICT(email) DO UPDATE SET full_name = customers.full_name RETURNING id',
      args: [crypto.randomUUID(), email, fullName, nowIso],
    });
    const customerId = String(crs.rows[0].id);

    // A session the person already cancelled can't be booked again (amendment K).
    const prior = await tx.execute({
      sql: "SELECT 1 FROM bookings WHERE customer_id = ? AND session_id = ? AND status = 'cancelled' LIMIT 1",
      args: [customerId, sessionId],
    });
    if (prior.rows.length) throw bad(rebookBlockedMessage(settings.studio_email), 'session_rebook_blocked');

    // 4. Free plan: claim the one free class, atomically
    if (planKey === 'free') {
      const claim = await tx.execute({
        sql: 'UPDATE customers SET used_free_class = 1 WHERE id = ? AND used_free_class = 0',
        args: [customerId],
      });
      if (claim.rowsAffected === 0) {
        throw bad('This email has already used its free first class. Please choose a single class or class pack.');
      }
    }

    // 5. Take a seat only if one is left
    const seat = await tx.execute({
      sql: 'UPDATE sessions SET booked_count = booked_count + 1 WHERE id = ? AND booked_count < capacity AND start_utc > ?',
      args: [sessionId, nowIso],
    });
    if (seat.rowsAffected === 0) throw bad('This class session is fully booked. Please choose another slot.');

    // 6. Paid plan: record an order. The server sets the status; it is never 'paid' here.
    let orderId: string | null = null;
    if (planKey !== 'free' && paymentMethod) {
      const price = PLAN_PRICES[planKey];
      orderId = crypto.randomUUID();
      let expiresAt: string | null = null;
      if (price.validMonths) {
        const d = new Date(now);
        d.setUTCMonth(d.getUTCMonth() + price.validMonths);
        expiresAt = d.toISOString();
      }
      await tx.execute({
        sql:
          'INSERT INTO orders (id, customer_id, plan_key, amount_aed, payment_method, payment_status, credits_total, credits_left, expires_at, created_at) ' +
          'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        args: [
          orderId,
          customerId,
          planKey,
          price.amountAed,
          paymentMethod,
          paymentMethod === 'studio' ? 'pending_at_studio' : 'pending',
          price.credits,
          price.credits - 1,
          expiresAt,
          nowIso,
        ],
      });
    }

    // 7. The booking itself; the partial unique index stops a second confirmed seat
    try {
      await tx.execute({
        sql:
          'INSERT INTO bookings (id, token, customer_id, session_id, order_id, plan_key, mode, status, credit_status, booked_at) ' +
          "VALUES (?, ?, ?, ?, ?, ?, ?, 'confirmed', 'used', ?)",
        args: [bookingId, token, customerId, sessionId, orderId, planKey, mode, nowIso],
      });
    } catch (err) {
      if (isUniqueViolation(err)) throw bad('You are already booked for this session. Your booking token is in your confirmation email.');
      throw err;
    }
  });

  // 8. Committed. Emails are best-effort and never change the response status.
  const row = await bookingByToken(null, token);
  if (!row) throw new Error('booking vanished after commit');
  const booking = toBookingView(row);
  const session = sessionFromBookingRow(row);
  console.log(`booking_created id=${booking.id}`);

  const emailData = {
    bookingId: booking.id,
    token: booking.bookingToken,
    customerName: booking.customerName,
    customerEmail: booking.customerEmail,
    className: session.className,
    level: session.level,
    whenDubai: booking.sessionTimeDubai,
    mode: booking.mode,
    planKey: booking.planKey,
    amountAed: booking.amountAed,
    paymentStatus: booking.paymentStatus,
  };
  const [confirmation] = await Promise.all([
    sendBookingConfirmation(emailData, settings.studio_email),
    sendBookingAlert(emailData, settings.notify_email),
  ]);

  return {
    success: true,
    booking,
    session,
    message: "You're in. Booking confirmed!",
    // Only the student's own confirmation, and only if it really went out.
    dispatchedEmails: confirmation ? [confirmation] : [],
  };
}

export async function getBookingByToken(rawToken: unknown): Promise<{ booking: BookingView; session: SessionView }> {
  const token = normalizeBookingToken(rawToken);
  if (!token) throw new HttpError(404, NOT_FOUND);
  const row = await bookingByToken(null, token);
  if (!row) throw new HttpError(404, NOT_FOUND);
  return { booking: toBookingView(row), session: sessionFromBookingRow(row) };
}

export async function cancelBooking(rawToken: unknown): Promise<{
  success: true;
  booking: BookingView;
  noticeHours: number;
  message: string;
}> {
  if (typeof rawToken !== 'string' || !rawToken.trim()) throw bad('Booking token is required to cancel a reservation.');
  const token = normalizeBookingToken(rawToken);
  if (!token) throw new HttpError(404, NOT_FOUND);
  const now = Date.now();

  const outcome = await withWriteTx(async (tx) => {
    const row = await bookingByToken(tx, token);
    if (!row) throw new HttpError(404, NOT_FOUND);
    if (String(row.status) === 'cancelled') throw bad('This booking has already been cancelled.');
    const start = new Date(String(row.start_utc)).getTime();
    if (start <= now) throw bad('Cannot cancel a session that has already started or taken place.');

    const result = cancellationOutcome(start, now);
    const upd = await tx.execute({
      sql: "UPDATE bookings SET status = 'cancelled', credit_status = ?, cancelled_at = ? WHERE id = ? AND status = 'confirmed'",
      args: [result.creditStatus, new Date(now).toISOString(), String(row.id)],
    });
    if (upd.rowsAffected === 0) throw bad('This booking has already been cancelled.');

    await tx.execute({
      sql: 'UPDATE sessions SET booked_count = booked_count - 1 WHERE id = ? AND booked_count > 0',
      args: [String(row.session_id)],
    });

    if (result.creditStatus === 'refunded') {
      if (String(row.plan_key) === 'free') {
        // Early cancel gives the free first class back (amendment K).
        await tx.execute({ sql: 'UPDATE customers SET used_free_class = 0 WHERE id = ?', args: [String(row.customer_id)] });
      } else if (row.order_id) {
        await tx.execute({
          sql: 'UPDATE orders SET credits_left = credits_left + 1 WHERE id = ? AND credits_left < credits_total',
          args: [String(row.order_id)],
        });
      }
    }
    return result;
  });

  const row = await bookingByToken(null, token);
  if (!row) throw new Error('booking vanished after commit');
  const booking = toBookingView(row);
  console.log(`booking_cancelled id=${booking.id} credit=${outcome.creditStatus}`);

  const settings = await getSettings();
  await sendCancellationAlert(
    {
      bookingId: booking.id,
      token: booking.bookingToken,
      customerName: booking.customerName,
      customerEmail: booking.customerEmail,
      className: booking.sessionTitle,
      whenDubai: booking.sessionTimeDubai,
      planKey: booking.planKey,
      creditStatus: outcome.creditStatus,
      noticeHours: outcome.noticeHours,
    },
    settings.notify_email
  );

  const isFree = booking.planKey === 'free';
  const message =
    outcome.creditStatus === 'refunded'
      ? isFree
        ? 'Your booking has been cancelled. Your free first class is available again for a different session.'
        : 'Your booking has been cancelled and your class credit has been refunded.'
      : isFree
        ? 'Late cancellation (less than 6 hours notice): your seat has been released, and the free first class counts as used.'
        : 'Late cancellation (less than 6 hours notice): your seat has been released, but under studio policy the class credit is used.';

  return { success: true, booking, noticeHours: outcome.noticeHours, message };
}
