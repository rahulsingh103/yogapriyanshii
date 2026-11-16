import crypto from 'crypto';
import { getConfig } from './config.js';

// Plain-text email. Sending never throws and never blocks longer than SEND_TIMEOUT_MS:
// a booking or message is already committed by the time we get here.

const SEND_TIMEOUT_MS = 5000;

export type EmailKind =
  | 'booking_confirmation'
  | 'booking_alert'
  | 'cancellation_alert'
  | 'contact_alert'
  | 'login_code'
  | 'login_no_account'
  | 'offer';

export interface EmailRecord {
  id: string;
  kind: EmailKind;
  type: 'student_confirmation' | 'studio_alert' | 'student_account' | 'student_offer';
  recipient: string;
  sender: string;
  replyTo?: string;
  subject: string;
  body: string;
  sentAt: string;
  /** Account and offer emails only: extra headers, and the id on their log line. */
  headers?: Record<string, string>;
  ref?: string;
}

interface Draft {
  kind: EmailKind;
  to: string;
  replyTo?: string;
  subject: string;
  body: string;
  /** A non-personal reference (booking or message id, or a random id) for the log line. Never an email address. */
  ref: string;
  headers?: Record<string, string>;
}

// --- test outbox (APP_ENV=test only) ---
const outbox: EmailRecord[] = [];
let failNextSends = false;

export const testOutbox = {
  list: () => outbox.slice(0, 50),
  clear: () => {
    outbox.length = 0;
  },
  setFailing: (fail: boolean) => {
    failNextSends = fail;
  },
};

function logEvent(event: 'email_sent' | 'email_failed', kind: EmailKind, ref: string) {
  console.log(`${event} type=${kind} id=${ref}`);
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('email timeout')), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}

function recordType(kind: EmailKind): EmailRecord['type'] {
  if (kind === 'booking_confirmation') return 'student_confirmation';
  if (kind === 'login_code' || kind === 'login_no_account') return 'student_account';
  if (kind === 'offer') return 'student_offer';
  return 'studio_alert';
}

async function deliver(draft: Draft): Promise<EmailRecord | null> {
  const { email, emailFrom, offersFrom } = getConfig();
  const from = draft.kind === 'offer' ? offersFrom : emailFrom;
  const record: EmailRecord = {
    id: `email-${crypto.randomUUID()}`,
    kind: draft.kind,
    type: recordType(draft.kind),
    recipient: draft.to,
    sender: from,
    replyTo: draft.replyTo || undefined,
    subject: draft.subject,
    body: draft.body,
    sentAt: new Date().toISOString(),
    ...(draft.kind === 'login_code' || draft.kind === 'login_no_account' || draft.kind === 'offer'
      ? { ref: draft.ref, ...(draft.headers ? { headers: draft.headers } : {}) }
      : {}),
  };

  try {
    if (!draft.to) throw new Error('no recipient');
    switch (email.kind) {
      case 'outbox':
        if (failNextSends) throw new Error('simulated failure');
        outbox.unshift(record);
        break;
      case 'log':
        break; // development: the log line below is the whole delivery
      case 'resend': {
        const { Resend } = await import('resend');
        const client = new Resend(email.apiKey);
        const { error } = await withTimeout(
          client.emails.send({
            from,
            to: draft.to,
            subject: draft.subject,
            text: draft.body,
            ...(draft.replyTo ? { replyTo: draft.replyTo } : {}),
            ...(draft.headers ? { headers: draft.headers } : {}),
          }),
          SEND_TIMEOUT_MS
        );
        if (error) throw new Error('provider rejected');
        break;
      }
      case 'none':
        throw new Error('email not configured');
    }
    logEvent('email_sent', draft.kind, draft.ref);
    return record;
  } catch {
    logEvent('email_failed', draft.kind, draft.ref);
    return null;
  }
}

// --- templates ---

const STUDIO_AREA = 'Dubai';

export interface BookingEmailData {
  bookingId: string;
  token: string;
  customerName: string;
  customerEmail: string;
  className: string;
  level: string;
  whenDubai: string;
  mode: 'in_person' | 'online';
  planKey: string;
  amountAed: number;
  paymentStatus: 'free' | 'pending' | 'pending_at_studio' | 'paid';
}

const PLAN_TITLES: Record<string, string> = {
  free: 'Trial class',
  single: 'Single drop-in (1 class)',
  pack10: '10-class pack',
  pack20: '20-class pack',
};

const aed = (amount: number) => `AED ${amount.toLocaleString('en-US')}`;

/** Online bookings also store pending_at_studio, so the wording follows the mode. */
function paymentLine(d: BookingEmailData, reader: 'student' | 'studio'): string {
  if (d.paymentStatus === 'paid') return `${aed(d.amountAed)}, paid`;
  if (d.paymentStatus === 'pending_at_studio') {
    if (d.mode === 'in_person') return `${aed(d.amountAed)}, to pay in person at your session`;
    return reader === 'student'
      ? `${aed(d.amountAed)}. Priyanshi will send you the payment details.`
      : `${aed(d.amountAed)}. Online: send the student the payment details.`;
  }
  return `${aed(d.amountAed)}, payment pending. Priyanshi will confirm how to pay.`;
}

function formatLine(mode: BookingEmailData['mode']): string {
  return mode === 'in_person' ? 'In person, Dubai (Priyanshi will confirm the details with you)' : 'Live online stream';
}

export async function sendBookingConfirmation(d: BookingEmailData, studioEmail: string): Promise<EmailRecord | null> {
  const body = `Hi ${d.customerName}, this is Priyanshi.

Thank you for taking the first step towards a healthier, calmer you. Stepping onto the mat is often the hardest part, and I'm honoured to guide you.

Your session:
• Class: ${d.className} (${d.level})
• Date & Time: ${d.whenDubai} (Dubai time, GMT+4)
• Format: ${formatLine(d.mode)}
• Plan: ${PLAN_TITLES[d.planKey] ?? d.planKey}
• Payment: ${paymentLine(d, 'student')}
• Your Booking Token: ${d.token}

A few gentle tips:
- Please arrive 10 minutes early so we can talk about any areas or injuries you'd like to work with.
- Priyanshi will message you before class to confirm where and how.
- Wear comfortable clothing you can breathe and move in.
- Cancel or move for free up to 24 hours before class. Later than that but not on the day, you can move it once; on the day, the class is charged. Use your booking token on the website under "Manage Booking".

See you on the mat.

With warmth,
Priyanshi
YogaPriyanshi · ${STUDIO_AREA}`;

  return deliver({
    kind: 'booking_confirmation',
    to: d.customerEmail,
    replyTo: studioEmail || undefined,
    subject: `You're booked: ${d.className}, ${d.whenDubai}`,
    body,
    ref: d.bookingId,
  });
}

export async function sendBookingAlert(d: BookingEmailData, notifyEmail: string): Promise<EmailRecord | null> {
  const body = `A student has just booked a class.

• Student: ${d.customerName}
• Email: ${d.customerEmail}
• Class: ${d.className}
• Date & Time: ${d.whenDubai} (Dubai time, GMT+4)
• Format: ${formatLine(d.mode)}
• Plan: ${PLAN_TITLES[d.planKey] ?? d.planKey}
• Payment: ${paymentLine(d, 'studio')}
• Booking token: ${d.token}

Reply to this email to write to the student directly.`;

  return deliver({
    kind: 'booking_alert',
    to: notifyEmail,
    replyTo: d.customerEmail,
    subject: `New booking: ${d.customerName}, ${d.className} (${d.whenDubai})`,
    body,
    ref: d.bookingId,
  });
}

export interface CancellationEmailData {
  bookingId: string;
  token: string;
  customerName: string;
  customerEmail: string;
  className: string;
  whenDubai: string;
  planKey: string;
  creditStatus: 'refunded' | 'burned';
  noticeHours: number;
  /** Given back as the one late move (less than 24 hours, not on the day). */
  lateMove?: boolean;
}

export async function sendCancellationAlert(d: CancellationEmailData, notifyEmail: string): Promise<EmailRecord | null> {
  const outcome = d.lateMove
    ? d.planKey === 'free'
      ? 'Moved late (under 24 hours, not on the day): their one late move. They can book the trial class for another day.'
      : 'Moved late (under 24 hours, not on the day): their one late move. The class credit was given back.'
    : d.creditStatus === 'refunded'
      ? d.planKey === 'free'
        ? 'Cancelled with 24+ hours notice: they can book the trial class again.'
        : 'Cancelled with 24+ hours notice: the class credit was refunded.'
      : d.planKey === 'free'
        ? 'Late cancellation: the seat was released and the trial counts as used (AED 90 is due).'
        : 'Late cancellation: the seat was released and the credit is used.';

  const body = `A booking was cancelled.

• Student: ${d.customerName}
• Email: ${d.customerEmail}
• Class: ${d.className}
• Date & Time: ${d.whenDubai} (Dubai time, GMT+4)
• Notice given: ${d.noticeHours.toFixed(1)} hours
• Booking token: ${d.token}

${outcome}`;

  return deliver({
    kind: 'cancellation_alert',
    to: notifyEmail,
    replyTo: d.customerEmail,
    subject: `Cancelled: ${d.customerName}, ${d.className} (${d.whenDubai})`,
    body,
    ref: d.bookingId,
  });
}

export interface ContactEmailData {
  messageId: string;
  name: string;
  email: string;
  /** Optional; the alert only shows a phone line when one was given. */
  phone: string | null;
  interest: string;
  message: string;
  /** Extra lines after Interest (a membership request's plan and format). Other messages have none. */
  details?: string[];
}

export async function sendContactAlert(d: ContactEmailData, notifyEmail: string): Promise<EmailRecord | null> {
  const hasDetails = Boolean(d.details?.length);
  const body = `New message from the website contact form.

• Name: ${d.name}
• Email: ${d.email}${d.phone ? `\n• Phone: ${d.phone}` : ''}
• Interest: ${d.interest}${hasDetails ? `\n${d.details!.join('\n')}` : ''}

${hasDetails && !d.message ? 'No preferred times given.' : d.message}

Reply to this email to answer ${d.name} directly.`;

  return deliver({
    kind: 'contact_alert',
    to: notifyEmail,
    replyTo: d.email,
    subject: `New message: ${d.name} (${d.interest})`,
    body,
    ref: d.messageId,
  });
}

// --- student accounts and offers: no name anywhere, and the log line's id is random ---

/** For a new account, `offers` says what entering the code will set, so nobody is opted in unawares. */
const OFFERS_LINE = {
  on: '\n\nEntering it also turns on monthly and holiday offers by email from Priyanshi. You can turn them off in your account at any time.',
  off: '\n\nOffers by email stay off. You can turn them on in your account at any time.',
};

/** `offers` is null for an existing account: the code only logs in and changes no setting. */
export function sendLoginCode(to: string, code: string, offers: boolean | null): Promise<EmailRecord | null> {
  return deliver({
    kind: 'login_code',
    to,
    subject: 'Your YogaPriyanshi code',
    body: `Your code is ${code}.

Enter it on the website within 10 minutes. It works once.${offers === null ? '' : offers ? OFFERS_LINE.on : OFFERS_LINE.off}

If you didn't ask for this, you can ignore this email. Nothing changes.

YogaPriyanshi · ${STUDIO_AREA}`,
    ref: crypto.randomUUID(),
  });
}

export function sendNoAccountNotice(to: string): Promise<EmailRecord | null> {
  return deliver({
    kind: 'login_no_account',
    to,
    subject: 'No YogaPriyanshi account for this email yet',
    body: `Someone asked to log in to YogaPriyanshi with this email, but it doesn't have an account yet.

To make one, choose Sign up at ${getConfig().siteUrl}. You don't need an account to read or book.

If this wasn't you, you can ignore this email. Nothing changes.

YogaPriyanshi · ${STUDIO_AREA}`,
    ref: crypto.randomUUID(),
  });
}

/** The part of every offer email that Priyanshi can't edit. The Offers tab shows it at review. */
export function offerFooter(unsubscribeLink: string): string {
  return `--
You're getting this because you chose to get offers from YogaPriyanshi.
Unsubscribe: ${unsubscribeLink}`;
}

export function sendOfferEmail(d: {
  to: string;
  subject: string;
  body: string;
  unsubscribeToken: string;
}): Promise<EmailRecord | null> {
  const { siteUrl } = getConfig();
  const query = `token=${encodeURIComponent(d.unsubscribeToken)}`;
  return deliver({
    kind: 'offer',
    to: d.to,
    subject: d.subject,
    body: `${d.body}\n\n${offerFooter(`${siteUrl}/unsubscribe?${query}`)}`,
    ref: crypto.randomUUID(),
    headers: {
      'List-Unsubscribe': `<${siteUrl}/api/offers/unsubscribe?${query}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  });
}
