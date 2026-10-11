import crypto from 'crypto';
import { withWriteTx } from './db.js';
import { sendContactAlert } from './email.js';
import { getSettings } from './settings.js';
import { CONTACT_INTERESTS, bad, cleanText, normalizeEmail, oneOf, phoneOrEmpty } from './validate.js';

const THANKS = 'Thank you — Priyanshi will be in touch within 24 hours.';

export async function submitContact(body: Record<string, unknown>): Promise<{ success: true; message: string }> {
  // Bots fill the hidden field; let them think it worked and store nothing.
  if (body.website || body.honeypot) return { success: true, message: THANKS };

  const name = cleanText(body.name, 100, { singleLine: true });
  const rawEmail = typeof body.email === 'string' ? body.email : '';
  const message = cleanText(body.message, 2000);
  if (!name || !rawEmail.trim() || !message) throw bad('Please provide your name, email, and message.');
  const email = normalizeEmail(rawEmail);
  if (!email) throw bad('Please provide a valid email address.');
  const interest =
    body.interest === undefined || body.interest === '' ? 'General enquiry' : oneOf(body.interest, CONTACT_INTERESTS);
  if (!interest) throw bad('Please choose what you are interested in.');
  const phoneInput = phoneOrEmpty(body.phone);
  if (phoneInput === null) throw bad('Please enter a valid phone number, or leave it empty.');
  const phone = phoneInput || null;

  const id = crypto.randomUUID();
  await withWriteTx(async (tx) => {
    await tx.execute({
      sql: 'INSERT INTO contact_messages (id, name, email, phone, interest, message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: [id, name, email, phone, interest, message, new Date().toISOString()],
    });
  });
  console.log(`contact_received id=${id}`); // no personal data (name, email, phone) in logs

  const settings = await getSettings();
  await sendContactAlert({ messageId: id, name, email, phone, interest, message }, settings.notify_email);
  return { success: true, message: THANKS };
}
