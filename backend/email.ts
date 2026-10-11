import crypto from 'crypto';
import { getConfig } from './config.js';

// Plain-text email. Sending never throws and never blocks longer than SEND_TIMEOUT_MS:
// a booking or message is already committed by the time we get here.

const SEND_TIMEOUT_MS = 5000;

export type EmailKind = 'booking_confirmation' | 'booking_alert' | 'cancellation_alert' | 'contact_alert';

export interface EmailRecord {
  id: string;
  kind: EmailKind;
  type: 'student_confirmation' | 'studio_alert';
  recipient: string;
  sender: string;
  replyTo?: string;
  subject: string;
  body: string;
  sentAt: string;
}

interface Draft {
  kind: EmailKind;
  to: string;
  replyTo?: string;
  subject: string;
  body: string;
  /** A non-personal reference (booking or message id) for the log line. */
  ref: string;
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

async function deliver(draft: Draft): Promise<EmailRecord | null> {
  const { email, emailFrom } = getConfig();
  const record: EmailRecord = {
    id: `email-${crypto.randomUUID()}`,
    kind: draft.kind,
    type: draft.kind === 'booking_confirmation' ? 'student_confirmation' : 'studio_alert',
    recipient: draft.to,
    sender: emailFrom,
    replyTo: draft.replyTo || undefined,
    subject: draft.subject,
    body: draft.body,
    sentAt: new Date().toISOString(),
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
            from: emailFrom,
            to: draft.to,
            subject: draft.subject,
            text: draft.body,
            ...(draft.replyTo ? { replyTo: draft.replyTo } : {}),
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

const STUDIO_ADDRESS = 'BurJuman Residence Block D, Dubai';

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
  free: 'Complimentary first class',
  single: 'Single drop-in (1 class)',
  pack10: '10-class pack',
  pack20: '20-class pack',
};

function paymentLine(d: BookingEmailData): string {
  if (d.paymentStatus === 'free') return 'Complimentary (AED 0)';
  if (d.paymentStatus === 'pending_at_studio') return `AED ${d.amountAed}, to pay at the studio reception`;
  if (d.paymentStatus === 'paid') return `AED ${d.amountAed}, paid`;
  return `AED ${d.amountAed}, payment pending. Priyanshi will confirm how to pay.`;
}

function formatLine(mode: BookingEmailData['mode']): string {
  return mode === 'in_person' ? `In person at ${STUDIO_ADDRESS}` : 'Live online stream';
}

export async function sendBookingConfirmation(d: BookingEmailData, studioEmail: string): Promise<EmailRecord | null> {
  const body = `Hi ${d.customerName}, this is Priyanshi.

Thank you for taking the first step towards a healthier, calmer you. Stepping onto the mat is often the hardest part, and I'm honoured to guide you.

Your session:
• Class: ${d.className} (${d.level})
• Date & Time: ${d.whenDubai} (Dubai time, GMT+4)
• Format: ${formatLine(d.mode)}
• Plan: ${PLAN_TITLES[d.planKey] ?? d.planKey}
• Payment: ${paymentLine(d)}
• Your Booking Token: ${d.token}

A few gentle tips:
- Please arrive 10 minutes early so we can talk about any areas or injuries you'd like to work with.
- Mats, blocks, bolsters and straps are provided at the studio.
- Wear comfortable clothing you can breathe and move in.
- Cancellations are free up to 6 hours before class. Use your booking token on the website under "Manage Booking".

See you on the mat.

With warmth,
Priyanshi
YogaPriyanshi · ${STUDIO_ADDRESS}`;

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
• Payment: ${paymentLine(d)}
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
}

export async function sendCancellationAlert(d: CancellationEmailData, notifyEmail: string): Promise<EmailRecord | null> {
  const outcome =
    d.creditStatus === 'refunded'
      ? d.planKey === 'free'
        ? 'Cancelled with 6+ hours notice: the free first class is available to them again.'
        : 'Cancelled with 6+ hours notice: the class credit was refunded.'
      : 'Late cancellation (under 6 hours): the seat was released and the credit is used.';

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
  interest: string;
  message: string;
}

export async function sendContactAlert(d: ContactEmailData, notifyEmail: string): Promise<EmailRecord | null> {
  const body = `New message from the website contact form.

• Name: ${d.name}
• Email: ${d.email}
• Interest: ${d.interest}

${d.message}

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
