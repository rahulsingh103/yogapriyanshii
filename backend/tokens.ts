import crypto from 'crypto';

// Crockford base32: no I, L, O or U, so tokens survive being read aloud or retyped.
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const BOOKING_TOKEN_RE = /^YP-[0-9A-HJKMNP-TV-Z]{16}$/;

/** `YP-` + 16 Crockford characters (80 random bits). */
export function newBookingToken(): string {
  const bytes = crypto.randomBytes(16);
  let out = '';
  for (let i = 0; i < 16; i++) out += CROCKFORD[bytes[i] & 31];
  return `YP-${out}`;
}

/** Trims, uppercases and maps I/L to 1 and O to 0. Returns null if the result can't be a token. */
export function normalizeBookingToken(input: unknown): string | null {
  if (typeof input !== 'string' || input.length > 64) return null;
  let s = input.trim().toUpperCase().replace(/\s+/g, '');
  if (!s.startsWith('YP-')) return null;
  s = 'YP-' + s.slice(3).replace(/[IL]/g, '1').replace(/O/g, '0');
  return BOOKING_TOKEN_RE.test(s) ? s : null;
}

/** 32 random bytes for the admin; only the SHA-256 is stored. */
export function newAdminToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}
