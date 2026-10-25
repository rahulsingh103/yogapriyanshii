import crypto from 'crypto';
import { withWriteTx } from './db.js';
import { sendContactAlert } from './email.js';
import { MEMBERSHIP_INTEREST, MEMBERSHIP_PLAN, membershipAlertDetails } from './membership.js';
import { getSettings } from './settings.js';
import {
  CONTACT_INTERESTS,
  MEMBER_FORMATS,
  bad,
  cleanText,
  normalizeEmail,
  oneOf,
  phoneOrEmpty,
  str,
  type MemberFormat,
} from './validate.js';

const THANKS = 'Thank you — Priyanshi will be in touch within 24 hours.';

// Membership requests ("Join the membership") are contact messages with interest "Monthly membership".
// Their message is the optional "Preferred days and times", and they may say in person or online.
// The site's WhatsApp hand-off after a request carries only the name the person typed and the plan
// (owner-approved, sent only when they tap); nothing here sends anything to WhatsApp.

export async function submitContact(body: Record<string, unknown>): Promise<{ success: true; message: string }> {
  // Bots fill the hidden field; let them think it worked and store nothing.
  if (body.website || body.honeypot) return { success: true, message: THANKS };

  const name = cleanText(body.name, 100, { singleLine: true });
  const rawEmail = typeof body.email === 'string' ? body.email : '';
  const interest =
    body.interest === undefined || body.interest === '' ? 'General enquiry' : oneOf(body.interest, CONTACT_INTERESTS);
  const isMembership = interest === MEMBERSHIP_INTEREST;

  let message: string | null;
  if (isMembership) {
    // Optional: empty (or only whitespace) is stored as ''.
    const times = str(body.message).replace(/\r\n?/g, '\n').trim();
    message = times ? cleanText(times, 2000) : '';
    if (!name || !rawEmail.trim()) throw bad('Please provide your name and email.');
    // Length first; any other rejection from cleanText is a control character.
    if (times.length > 2000) throw bad('Please keep your preferred times under 2000 characters.');
    if (message === null) throw bad('Please remove unusual characters from your preferred times.');
  } else {
    message = cleanText(body.message, 2000);
    if (!name || !rawEmail.trim() || !message) throw bad('Please provide your name, email, and message.');
  }
  const email = normalizeEmail(rawEmail);
  if (!email) throw bad('Please provide a valid email address.');
  if (!interest) throw bad('Please choose what you are interested in.');
  const phoneInput = phoneOrEmpty(body.phone);
  if (phoneInput === null) throw bad('Please enter a valid phone number, or leave it empty.');
  const phone = phoneInput || null;

  // Only a membership request reads `format`; other interests ignore it.
  let format: MemberFormat | null = null;
  if (isMembership && body.format !== undefined && body.format !== '') {
    format = oneOf(body.format, MEMBER_FORMATS);
    if (!format) throw bad('Please choose in person or online, or leave it empty.');
  }

  const id = crypto.randomUUID();
  // Everything inside the callback: it can be retried, and the request is stored with its message or not at all.
  await withWriteTx(async (tx) => {
    const now = new Date().toISOString();
    await tx.execute({
      sql: 'INSERT INTO contact_messages (id, name, email, phone, interest, message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: [id, name, email, phone, interest, message, now],
    });
    if (isMembership) {
      await tx.execute({
        sql:
          'INSERT INTO membership_requests (message_id, plan_key, plan_label, price_aed, format, status, start_date, created_at, updated_at) ' +
          "VALUES (?, ?, ?, ?, ?, 'new', NULL, ?, ?)",
        args: [id, MEMBERSHIP_PLAN.key, MEMBERSHIP_PLAN.label, MEMBERSHIP_PLAN.priceAed, format, now, now],
      });
    }
  });
  console.log(`contact_received id=${id}`); // no personal data (name, email, phone) in logs
  if (isMembership) console.log(`membership_requested id=${id}`);

  const settings = await getSettings();
  await sendContactAlert(
    {
      messageId: id,
      name,
      email,
      phone,
      interest,
      message,
      ...(isMembership ? { details: membershipAlertDetails(format) } : {}),
    },
    settings.notify_email
  );
  return { success: true, message: THANKS };
}
