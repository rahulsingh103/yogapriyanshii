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
  // The monthly membership (Pricing card): also stores a membership_requests row (backend/membership.ts).
  'Monthly membership',
  'Class Packs & Corporate',
  // Classes not on the timetable yet: their carousel cards open the contact form with these preset.
  'Spine Healing',
  'Mobility Yoga',
  'Yin Yoga',
  'Prenatal & Postnatal',
  'Vinyasa Yoga',
  'Ashtanga Yoga',
  // Aerial is private sessions only, on request.
  'Private Aerial Yoga',
] as const;

export const MEMBER_STATUSES = ['new', 'contacted', 'active'] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];

export const MEMBER_FORMATS = ['in_person', 'online'] as const;
export type MemberFormat = (typeof MEMBER_FORMATS)[number];

/** crypto.randomUUID() ids (lowercase v4), e.g. contact message ids. */
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

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

const PHONE_RE = /^\+?[0-9 ()-]{6,24}$/;

/**
 * Optional phone number. Empty means none (returns '' so the caller stores NULL).
 * Otherwise: one line, at most 30 characters, digits with an optional leading +, spaces,
 * brackets and dashes, and 6 to 15 digits in total. Returns null when invalid.
 */
export function phoneOrEmpty(value: unknown): string | null {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') return null;
  const s = value.trim();
  if (!s) return '';
  if (s.length > 30 || /[\r\n]/.test(s) || !PHONE_RE.test(s)) return null;
  const digits = s.replace(/\D/g, '').length;
  return digits >= 6 && digits <= 15 ? s : null;
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

/** A real calendar date as `YYYY-MM-DD` (2026-02-30 is refused), or null. */
export function isoDateOrNull(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d ? value : null;
}
