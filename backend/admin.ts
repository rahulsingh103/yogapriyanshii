import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { getConfig } from './config.js';
import { getDb, withWriteTx } from './db.js';
import { toBookingView, type BookingView } from './bookings.js';
import { dubaiMonth, upcomingSessions, type SessionView } from './schedule.js';
import { getSettings, updateSettings } from './settings.js';
import { newAdminToken, sha256 } from './tokens.js';
import { HttpError, bad, httpsUrlOrEmpty, normalizeEmail } from './validate.js';

const ADMIN_ID = 1;
const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;
const SESSION_MS = 2 * 60 * 60 * 1000;
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function scrypt(password: string, salt: Buffer, keylen: number): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    crypto.scrypt(password, salt, keylen, SCRYPT, (err, key) => (err ? reject(err) : resolve(key)))
  );
}

/** `scrypt$<salt-b64>$<hash-b64>` (N=16384, r=8, p=1). */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}

function parseHash(stored: string): { salt: Buffer; key: Buffer } | null {
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return null;
  const salt = Buffer.from(parts[1], 'base64');
  const key = Buffer.from(parts[2], 'base64');
  if (salt.length < 8 || key.length < 32) return null;
  return { salt, key };
}

async function verifyPassword(password: string, stored: { salt: Buffer; key: Buffer }): Promise<boolean> {
  const candidate = await scrypt(password, stored.salt, stored.key.length);
  return crypto.timingSafeEqual(candidate, stored.key);
}

export async function login(body: Record<string, unknown>) {
  const configured = getConfig().adminPasswordHash;
  const parsed = configured ? parseHash(configured) : null;
  if (!parsed) {
    if (configured) console.log('admin_hash_invalid');
    throw new HttpError(503, "Admin sign-in isn't available yet.");
  }

  const password = typeof body.password === 'string' ? body.password : '';
  if (!password) throw bad('Password is required.');
  if (password.length > 200) throw new HttpError(401, 'Invalid admin password.');

  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  // Claim an attempt before the (slow) password check, in one write. Concurrent guesses each
  // take a slot, so no more than MAX_ATTEMPTS ever reach scrypt before the lock applies.
  const claim = await withWriteTx(async (tx) => {
    const rs = await tx.execute({
      sql:
        'UPDATE admin_users SET failed_attempts = failed_attempts + 1 ' +
        'WHERE id = ? AND (locked_until IS NULL OR locked_until <= ?) RETURNING failed_attempts',
      args: [ADMIN_ID, nowIso],
    });
    if (!rs.rows.length) {
      const ars = await tx.execute({ sql: 'SELECT locked_until FROM admin_users WHERE id = ? LIMIT 1', args: [ADMIN_ID] });
      if (!ars.rows.length) return { kind: 'missing' as const };
      const until = ars.rows[0].locked_until ? new Date(String(ars.rows[0].locked_until)).getTime() : now + LOCK_MS;
      return { kind: 'locked' as const, until };
    }
    const n = Number(rs.rows[0].failed_attempts);
    if (n >= MAX_ATTEMPTS) {
      await tx.execute({
        sql: 'UPDATE admin_users SET failed_attempts = 0, locked_until = ? WHERE id = ?',
        args: [new Date(now + LOCK_MS).toISOString(), ADMIN_ID],
      });
    }
    return { kind: 'claimed' as const, attempts: n };
  });
  if (claim.kind === 'missing') throw new HttpError(503, "Admin sign-in isn't available yet.");
  if (claim.kind === 'locked') {
    const minutes = Math.max(1, Math.ceil((claim.until - now) / 60000));
    throw new HttpError(
      429,
      `Too many failed attempts. Admin portal is locked for security. Please try again in ${minutes} minute(s).`
    );
  }

  const ok = await verifyPassword(password, parsed);
  if (!ok) {
    console.log('admin_login_failed');
    if (claim.attempts >= MAX_ATTEMPTS) {
      throw new HttpError(429, '5 consecutive failed attempts. Admin portal locked for 15 minutes for your protection.');
    }
    const left = MAX_ATTEMPTS - claim.attempts;
    throw new HttpError(401, `Invalid admin password. (${left} attempt${left === 1 ? '' : 's'} remaining before 15-min lockout)`);
  }

  const token = newAdminToken();
  // The reset and the new session commit together.
  await withWriteTx(async (tx) => {
    await tx.execute({ sql: 'UPDATE admin_users SET failed_attempts = 0, locked_until = NULL WHERE id = ?', args: [ADMIN_ID] });
    await tx.execute({ sql: 'DELETE FROM admin_sessions WHERE expires_at <= ?', args: [new Date(now).toISOString()] });
    await tx.execute({
      sql: 'INSERT INTO admin_sessions (token_hash, admin_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
      args: [sha256(token), ADMIN_ID, new Date(now).toISOString(), new Date(now + SESSION_MS).toISOString()],
    });
  });
  console.log('admin_login_ok');
  return { success: true, token, expiresInHours: 2, message: 'Welcome back, Priyanshi.' };
}

/** Test-only (mounted under APP_ENV=test): clears the failed-attempt counter and any lock. */
export async function resetAdminLockout() {
  await withWriteTx(async (tx) => {
    await tx.execute({ sql: 'UPDATE admin_users SET failed_attempts = 0, locked_until = NULL WHERE id = ?', args: [ADMIN_ID] });
  });
}

function bearer(req: Request): string | null {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return null;
  const t = h.slice(7).trim();
  return /^[0-9a-f]{64}$/.test(t) ? t : null;
}

export async function logout(req: Request) {
  const token = bearer(req);
  if (token) {
    await withWriteTx(async (tx) => {
      await tx.execute({ sql: 'DELETE FROM admin_sessions WHERE token_hash = ?', args: [sha256(token)] });
    });
  }
  return { success: true };
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const token = bearer(req);
  if (!token) {
    res.status(401).json({ error: 'Unauthorized: Admin session token required.' });
    return;
  }
  getDb()
    .then((db) =>
      db.execute({
        sql: 'SELECT 1 FROM admin_sessions WHERE token_hash = ? AND expires_at > ? LIMIT 1',
        args: [sha256(token), new Date().toISOString()],
      })
    )
    .then((rs) => {
      if (!rs.rows.length) {
        res.status(401).json({ error: 'Session expired. Please log in again.' });
        return;
      }
      next();
    })
    .catch(next);
}

export interface AdminStatsResponse {
  totalRevenueAed: number;
  totalClients: number;
  newClientsThisMonth: number;
  upcomingBookingsCount: number;
  earnings6Months: { month: string; amountAed: number }[];
  upcomingSessions: SessionView[];
  recentMessages: { id: string; name: string; email: string; interest: string; message: string; createdAt: string }[];
  bookings: BookingView[];
  googleDriveLink: string;
  notificationEmail: string;
}

export async function stats(): Promise<AdminStatsResponse> {
  const db = await getDb();
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const thisMonth = dubaiMonth(now);

  // Six Dubai months ending with this one, oldest first, zero-filled.
  const months: { key: string; label: string; startUtc: number }[] = [];
  {
    const d = new Date(thisMonth.startUtc + 4 * 60 * 60 * 1000);
    for (let i = 5; i >= 0; i--) {
      const probe = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 15);
      months.push(dubaiMonth(probe));
    }
  }

  const [revenue, clients, newClients, upcoming, earnings, messages, recentBookings, sessions, settings] = await Promise.all([
    db.execute("SELECT COALESCE(SUM(amount_aed), 0) AS total FROM orders WHERE payment_status = 'paid'"),
    db.execute('SELECT COUNT(*) AS n FROM customers'),
    db.execute({ sql: 'SELECT COUNT(*) AS n FROM customers WHERE created_at >= ?', args: [new Date(thisMonth.startUtc).toISOString()] }),
    db.execute({
      sql: "SELECT COUNT(*) AS n FROM bookings b JOIN sessions s ON s.id = b.session_id WHERE b.status = 'confirmed' AND s.start_utc > ?",
      args: [nowIso],
    }),
    db.execute({
      // Dubai month of the payment date; '+4 hours' shifts UTC to Dubai.
      sql:
        "SELECT strftime('%Y-%m', paid_at, '+4 hours') AS month, SUM(amount_aed) AS total FROM orders " +
        "WHERE payment_status = 'paid' AND paid_at >= ? GROUP BY month ORDER BY month LIMIT 6",
      args: [new Date(months[0].startUtc).toISOString()],
    }),
    db.execute(
      'SELECT id, name, email, interest, message, created_at FROM contact_messages ORDER BY created_at DESC LIMIT 10'
    ),
    db.execute(
      'SELECT b.id, b.token, b.session_id, b.plan_key, b.mode, b.status, b.credit_status, b.booked_at, b.cancelled_at, ' +
        'b.customer_id, b.order_id, cu.email, cu.full_name, o.amount_aed, o.payment_method, o.payment_status, ' +
        's.start_utc, c.name AS class_name ' +
        'FROM bookings b JOIN customers cu ON cu.id = b.customer_id JOIN sessions s ON s.id = b.session_id ' +
        'JOIN classes c ON c.id = s.class_id LEFT JOIN orders o ON o.id = b.order_id ORDER BY b.booked_at DESC LIMIT 20'
    ),
    upcomingSessions(10, now),
    getSettings(),
  ]);

  const byMonth = new Map(earnings.rows.map((r) => [String(r.month), Number(r.total)]));
  return {
    totalRevenueAed: Number(revenue.rows[0]?.total ?? 0),
    totalClients: Number(clients.rows[0]?.n ?? 0),
    newClientsThisMonth: Number(newClients.rows[0]?.n ?? 0),
    upcomingBookingsCount: Number(upcoming.rows[0]?.n ?? 0),
    earnings6Months: months.map((m) => ({ month: m.label, amountAed: byMonth.get(m.key) ?? 0 })),
    upcomingSessions: sessions,
    recentMessages: messages.rows.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      email: String(r.email),
      interest: String(r.interest),
      message: String(r.message),
      createdAt: String(r.created_at),
    })),
    bookings: recentBookings.rows.map(toBookingView),
    googleDriveLink: settings.drive_link,
    notificationEmail: settings.notify_email,
  };
}

export async function saveSettings(body: Record<string, unknown>) {
  const update: { drive_link?: string; notify_email?: string } = {};
  if (body.googleDriveLink !== undefined) {
    const link = httpsUrlOrEmpty(body.googleDriveLink);
    if (link === null) throw bad('Please enter a valid https:// link for the Google Drive / Sheet, or leave it empty.');
    update.drive_link = link;
  }
  if (body.notificationEmail !== undefined) {
    const email = normalizeEmail(body.notificationEmail);
    if (!email) throw bad('Please enter a valid notification email address.');
    update.notify_email = email;
  }
  if (!Object.keys(update).length) throw bad('Nothing to update.');
  const settings = await updateSettings(update);
  console.log('admin_settings_updated');
  return {
    success: true,
    settings: { googleDriveLink: settings.drive_link, notificationEmail: settings.notify_email },
    message: 'Settings updated successfully.',
  };
}
