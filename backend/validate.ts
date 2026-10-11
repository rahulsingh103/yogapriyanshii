// Allowlists and length checks for every value that comes from the browser.

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string
  ) {
    super(message);
  }
}

export const bad = (message: string, code?: string) => new HttpError(400, message, code);

export const PLAN_KEYS = ['free', 'single', 'pack10', 'pack20'] as const;
export type PlanKey = (typeof PLAN_KEYS)[number];

// Until a real payment provider exists, paid classes are settled in person at the studio.
export const PAYMENT_METHODS = ['studio'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const CONTACT_INTERESTS = [
  'General enquiry',
  'Hatha Yoga',
  'Barre Yoga',
  'Wheel Yoga',
  'Chakra Yoga Flow',
  'Private session',
  'Class Packs & Corporate',
] as const;

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;
const SESSION_ID_RE = /^sess-[a-z]{2,12}-\d{10,16}$/;
const REST_ID_RE = /^sess-rest-\d{4}-\d{2}-\d{2}$/;

export function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** Trimmed text with no control characters other than newlines and tabs. */
export function cleanText(value: unknown, max: number, opts: { singleLine?: boolean } = {}): string | null {
  const s = str(value).replace(/\r\n?/g, '\n').trim();
  if (!s || s.length > max) return null;
  if (opts.singleLine && /[\n\t]/.test(s)) return null;
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(s)) return null;
  return s;
}

export function normalizeEmail(value: unknown): string | null {
  const s = str(value).trim().toLowerCase();
  if (!s || s.length > 254 || !EMAIL_RE.test(s)) return null;
  return s;
}

export function isRestDayId(value: string): boolean {
  return REST_ID_RE.test(value);
}

export function isSessionId(value: string): boolean {
  return SESSION_ID_RE.test(value);
}

export function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

/** Empty, or an https URL up to 500 characters. */
export function httpsUrlOrEmpty(value: unknown): string | null {
  const s = str(value).trim();
  if (!s) return '';
  if (s.length > 500) return null;
  try {
    const u = new URL(s);
    return u.protocol === 'https:' ? u.toString() : null;
  } catch {
    return null;
  }
}
