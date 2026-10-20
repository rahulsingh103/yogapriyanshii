/**
 * WhatsApp settings: the floating chat button, the Contact link and the booking confirmation link.
 *
 * The real business number isn't confirmed yet. Until `OWNER_NUMBER` is filled in, dev and the e2e
 * tests use a placeholder, and production builds (live and Vercel previews) get no number at all:
 * `WHATSAPP_ENABLED` is false there, so every WhatsApp surface stays hidden and the placeholder is
 * compiled out of the bundle (`import.meta.env.PROD` is a build-time constant).
 */

/**
 * The confirmed number with its country code. Any format works ("+971 50 123 4567" or 971501234567):
 * everything but the digits is stripped before it goes into the wa.me link.
 */
const OWNER_NUMBER: string = '+971 50 895 5421';
const PLACEHOLDER_NUMBER = '971500000000';

// The `&&` keeps this a build-time '' while the number is empty, so the WhatsApp code still drops out.
const OWNER_DIGITS = OWNER_NUMBER && OWNER_NUMBER.replace(/\D/g, '');

export const WHATSAPP_NUMBER: string = OWNER_DIGITS || (import.meta.env.PROD ? '' : PLACEHOLDER_NUMBER);

/** One switch for all three WhatsApp surfaces. */
export const WHATSAPP_ENABLED = WHATSAPP_NUMBER.length > 0;

/** The first message, written for the student. It never carries personal data. */
export const WHATSAPP_PREFILL =
  "Hi Priyanshi, I found you on yogapriyanshi.com and I'd like to know more about your classes.";

/** A wa.me chat link with the message typed in. */
export function whatsappUrl(text: string = WHATSAPP_PREFILL) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}
