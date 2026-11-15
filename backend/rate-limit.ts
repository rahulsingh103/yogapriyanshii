import crypto from 'crypto';
import type { Transaction } from '@libsql/client';
import type { Request } from 'express';
import { getConfig } from './config.js';

// Fixed-window counters in the database, because Vercel runs several instances. Keys are HMACs,
// so the table never holds a raw email or IP. Call these inside withWriteTx.

export const limitKey = (secret: string, scope: string, subject: string) =>
  crypto.createHmac('sha256', secret).update(`${scope}\0${subject}`).digest('hex');

export interface LimitState {
  count: number;
  /** Whole seconds until this window ends (0 when no window is open). */
  secondsLeft: number;
}

export async function readLimit(tx: Transaction, key: string, now: number): Promise<LimitState> {
  const rs = await tx.execute({ sql: 'SELECT count, expires_at FROM rate_limits WHERE key = ? LIMIT 1', args: [key] });
  const row = rs.rows[0];
  if (!row) return { count: 0, secondsLeft: 0 };
  const left = new Date(String(row.expires_at)).getTime() - now;
  return left > 0 ? { count: Number(row.count), secondsLeft: Math.ceil(left / 1000) } : { count: 0, secondsLeft: 0 };
}

/** Adds one to the window (starting a new one if it has ended) and returns the new count. */
export async function chargeLimit(tx: Transaction, key: string, windowMs: number, now: number): Promise<number> {
  const nowIso = new Date(now).toISOString();
  const rs = await tx.execute({
    sql:
      'INSERT INTO rate_limits (key, count, expires_at) VALUES (?, 1, ?) ' +
      'ON CONFLICT(key) DO UPDATE SET ' +
      'count = CASE WHEN rate_limits.expires_at <= ? THEN 1 ELSE rate_limits.count + 1 END, ' +
      'expires_at = CASE WHEN rate_limits.expires_at <= ? THEN excluded.expires_at ELSE rate_limits.expires_at END ' +
      'RETURNING count',
    args: [key, new Date(now + windowMs).toISOString(), nowIso, nowIso],
  });
  return Number(rs.rows[0].count);
}

/**
 * What an address is counted under. One IPv6 user usually holds a whole /64, so it is keyed by its first
 * four groups; IPv4 (and IPv4 written as IPv6, "::ffff:1.2.3.4") is the address itself.
 */
export function ipSubject(ip: string): string {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  if (mapped) return mapped[1];
  if (!ip.includes(':')) return ip;
  const bare = ip.split('%')[0].toLowerCase(); // drop a zone id ("fe80::1%en0")
  const [head, tail] = bare.split('::');
  const left = head ? head.split(':') : [];
  const right = tail === undefined ? [] : tail ? tail.split(':') : [];
  const groups = tail === undefined ? left : [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill('0'), ...right];
  if (groups.length !== 8 || groups.some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return bare;
  return `${groups.slice(0, 4).map((g) => parseInt(g, 16).toString(16)).join(':')}::/64`;
}

/**
 * The caller's address. On Vercel the platform sets x-vercel-forwarded-for and overwrites any value the
 * client sent; everywhere else forwarded headers could be forged, so only the socket counts.
 */
export function clientIp(req: Request): string {
  if (getConfig().onVercel) {
    const forwarded = req.headers['x-vercel-forwarded-for'];
    const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim();
    if (first) return ipSubject(first);
  }
  return ipSubject(req.socket.remoteAddress ?? 'unknown');
}
