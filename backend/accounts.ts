import crypto from 'crypto';
import type { Transaction } from '@libsql/client';
import type { NextFunction, Request, Response } from 'express';
import { getConfig } from './config.js';
import { getDb, withWriteTx } from './db.js';
import { sendLoginCode, sendNoAccountNotice } from './email.js';
import { chargeLimit, limitKey, readLimit } from './rate-limit.js';
import { sha256 } from './tokens.js';
import { HttpError, OFFERS_CONSENT, bad, normalizeEmail, oneOf } from './validate.js';

// Student accounts: email one-time codes, a 30-day session cookie and the offers setting. Separate from
// customers and bookings: reading and booking never need an account. Email never goes out inside a
// write transaction, because withWriteTx can retry its callback.

const COOKIE = 'yp_session';
const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_CODE_ATTEMPTS = 5;
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
const PURGE_BATCH = 100;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const IP_REQUEST_MAX = 20;
const IP_VERIFY_MAX = 60;
const EMAIL_WINDOWS = [
  { scope: 'email-minute', max: 1, windowMs: 60 * 1000 },
  { scope: 'email-hour', max: 5, windowMs: HOUR_MS },
  { scope: 'email-day', max: 10, windowMs: DAY_MS },
] as const;

/** Provisional: leaves room for booking email on the assumed 100-a-day plan (docs/SECURITY.md). */
const ACCOUNT_EMAIL_DAILY_CAP = 30;
let capOverride: number | null = null; // test routes only

export const ACCOUNTS_UNAVAILABLE = "Accounts aren't available right now. You don't need one to read or book.";
const NOT_SENT = "We couldn't send your email just now. Please try again in a few minutes.";
const CAP_REACHED = "We can't send account emails right now. Please try again later. You don't need an account to read or book.";
const TOO_MANY = 'Too many tries from here. Please wait a while and try again.';
const BAD_CODE = "That code didn't work. Check it and try again, or ask for a new one.";

export interface AccountView {
  email: string;
  offersOptIn: boolean;
}

const toView = (row: Record<string, unknown>): AccountView => ({
  email: String(row.email),
  offersOptIn: Number(row.offers_opt_in) === 1,
});

function requireSecret(): string {
  const secret = getConfig().accountSecret;
  if (!secret) throw new HttpError(503, ACCOUNTS_UNAVAILABLE);
  return secret;
}

/** Pure, so both modes can be tested without starting a server in production mode. */
export function sessionCookie(token: string, { secure }: { secure: boolean }): string {
  return `${COOKIE}=${token}; Max-Age=${SESSION_MS / 1000}; Path=/api; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
}

export function clearedSessionCookie({ secure }: { secure: boolean }): string {
  return `${COOKIE}=; Max-Age=0; Path=/api; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
}

function sessionTokenOf(req: Request): string | null {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0 && part.slice(0, eq).trim() === COOKIE) {
      const value = part.slice(eq + 1).trim();
      return /^[0-9a-f]{64}$/.test(value) ? value : null;
    }
  }
  return null;
}

/** CSRF for the cookie-carrying routes: JSON only, and the Origin must be this site. */
export function accountWriteGuard(req: Request, _res: Response, next: NextFunction) {
  if (!/^application\/json\b/i.test(req.headers['content-type'] ?? '')) {
    return next(new HttpError(415, 'Please send this request as JSON.'));
  }
  const forwarded = getConfig().onVercel ? req.headers['x-forwarded-host'] : undefined;
  const host = (Array.isArray(forwarded) ? forwarded[0] : forwarded) ?? req.headers.host;
  let originHost: string | null = null;
  try {
    originHost = req.headers.origin ? new URL(req.headers.origin).host : null;
  } catch {
    originHost = null;
  }
  if (!originHost || originHost !== host) return next(new HttpError(403, 'This request was refused.'));
  next();
}

function codeHash(secret: string, email: string, code: string): string {
  return crypto.createHmac('sha256', secret).update(`${email}\0${code}`).digest('hex');
}

function sameHash(a: string, b: string): boolean {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

/** A bounded delete per table, so one request never pays for a long backlog. */
const PURGE_SQL = [
  'DELETE FROM rate_limits WHERE key IN (SELECT key FROM rate_limits WHERE expires_at <= ? LIMIT ?)',
  'DELETE FROM login_codes WHERE email IN (SELECT email FROM login_codes WHERE expires_at <= ? LIMIT ?)',
  'DELETE FROM account_sessions WHERE token_hash IN (SELECT token_hash FROM account_sessions WHERE expires_at <= ? LIMIT ?)',
];

async function purgeExpired(tx: Transaction, nowIso: string) {
  for (const sql of PURGE_SQL) await tx.execute({ sql, args: [nowIso, PURGE_BATCH] });
}

const SENT = { success: true as const, message: 'Check your email.' };

const accountEmailCap = () => capOverride ?? ACCOUNT_EMAIL_DAILY_CAP;
const capKey = (secret: string) => limitKey(secret, 'account-email-cap', 'all');

/**
 * The same 200 and exactly one email in all four cases, so the answer never says whether an email has an
 * account: sign-up new, sign-up existing and log-in existing get a code; log-in unknown gets "No account
 * yet" and no code. The global cap is charged last, only once an email is really about to go.
 */
export async function requestCode(body: Record<string, unknown>, ip: string): Promise<typeof SENT> {
  if (body.website) return SENT; // bots fill the hidden field: same answer, nothing stored or sent

  const intent = oneOf(body.intent, ['signup', 'login'] as const);
  if (!intent) throw bad('Please choose log in or sign up.');
  const email = normalizeEmail(body.email);
  if (!email) throw bad('Please enter a valid email address.');
  const wantsOffers = body.offersOptIn === true;
  const secret = requireSecret();

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  const hash = codeHash(secret, email, code);
  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  // Returned, not thrown: a throw would roll the IP charge back.
  const decision = await withWriteTx(async (tx) => {
    const ipCount = await chargeLimit(tx, limitKey(secret, 'ip-request', ip), HOUR_MS, now);
    if (ipCount > IP_REQUEST_MAX) return { kind: 'limited' as const, message: TOO_MANY };

    for (const w of EMAIL_WINDOWS) {
      const state = await readLimit(tx, limitKey(secret, w.scope, email), now);
      if (state.count >= w.max) {
        return {
          kind: 'limited' as const,
          message:
            w.scope === 'email-minute'
              ? `Please wait ${state.secondsLeft} seconds before asking for another code.`
              : 'Too many codes for this email. Please try again later.',
        };
      }
    }
    // Only a request that passed the limits pays for the clean-up, so a flood can't make each one dearer.
    await purgeExpired(tx, nowIso);
    if ((await readLimit(tx, capKey(secret), now)).count >= accountEmailCap()) return { kind: 'cap' as const };

    for (const w of EMAIL_WINDOWS) await chargeLimit(tx, limitKey(secret, w.scope, email), w.windowMs, now);
    await chargeLimit(tx, capKey(secret), DAY_MS, now);

    const found = await tx.execute({ sql: 'SELECT id FROM accounts WHERE email = ? LIMIT 1', args: [email] });
    const exists = found.rows.length > 0;
    if (intent === 'login' && !exists) {
      // A write of the same shape that changes nothing, so this branch takes as long as the others.
      await tx.execute({ sql: 'UPDATE login_codes SET attempts = attempts WHERE email = ?', args: [email] });
      return { kind: 'no_account' as const };
    }

    // A new request replaces the old code. The tick only counts for a brand-new account.
    await tx.execute({
      sql:
        'INSERT INTO login_codes (email, code_hash, attempts, pending_offers, created_at, expires_at) VALUES (?, ?, 0, ?, ?, ?) ' +
        'ON CONFLICT(email) DO UPDATE SET code_hash = excluded.code_hash, attempts = 0, ' +
        'pending_offers = excluded.pending_offers, created_at = excluded.created_at, expires_at = excluded.expires_at',
      args: [email, hash, !exists && wantsOffers ? 1 : 0, nowIso, new Date(now + CODE_TTL_MS).toISOString()],
    });
    return { kind: 'code' as const, offers: exists ? null : wantsOffers };
  });

  if (decision.kind === 'limited') throw new HttpError(429, decision.message, 'rate_limited');
  if (decision.kind === 'cap') {
    console.log('account_email_cap_hit'); // no personal data in logs
    throw new HttpError(503, CAP_REACHED, 'account_email_cap');
  }

  const sent = decision.kind === 'code' ? await sendLoginCode(email, code, decision.offers) : await sendNoAccountNotice(email);
  if (!sent) throw new HttpError(503, NOT_SENT, 'email_failed');
  return SENT;
}

export async function verifyCode(
  body: Record<string, unknown>,
  ip: string
): Promise<{ account: AccountView; created: boolean; token: string }> {
  const secret = requireSecret();
  const email = normalizeEmail(body.email);
  const code = typeof body.code === 'string' ? body.code.trim() : '';
  if (!email || !/^\d{6}$/.test(code)) throw bad(BAD_CODE, 'invalid_code');

  const hash = codeHash(secret, email, code);
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  const result = await withWriteTx(async (tx) => {
    const ipCount = await chargeLimit(tx, limitKey(secret, 'ip-verify', ip), HOUR_MS, now);
    if (ipCount > IP_VERIFY_MAX) return { kind: 'limited' as const };

    // The attempt is claimed before comparing, so the sixth try fails even with the right code.
    const claimed = await tx.execute({
      sql:
        'UPDATE login_codes SET attempts = attempts + 1 WHERE email = ? AND expires_at > ? AND attempts < ? ' +
        'RETURNING code_hash, pending_offers',
      args: [email, nowIso, MAX_CODE_ATTEMPTS],
    });
    const row = claimed.rows[0];
    if (!row || !sameHash(String(row.code_hash), hash)) return { kind: 'failed' as const };

    const consumed = await tx.execute({
      sql: 'DELETE FROM login_codes WHERE email = ? AND code_hash = ? RETURNING email',
      args: [email, hash],
    });
    if (!consumed.rows.length) return { kind: 'failed' as const };

    const optedIn = Number(row.pending_offers) === 1;
    const inserted = await tx.execute({
      sql:
        'INSERT INTO accounts (id, email, created_at, unsubscribe_token, offers_opt_in, offers_consent_at, offers_consent_version) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(email) DO NOTHING RETURNING id',
      args: [
        crypto.randomUUID(),
        email,
        nowIso,
        crypto.randomBytes(32).toString('hex'),
        optedIn ? 1 : 0,
        optedIn ? nowIso : null,
        optedIn ? OFFERS_CONSENT.version : null,
      ],
    });
    const rs = await tx.execute({ sql: 'SELECT id, email, offers_opt_in FROM accounts WHERE email = ? LIMIT 1', args: [email] });
    const account = rs.rows[0];
    await tx.execute({
      sql: 'INSERT INTO account_sessions (token_hash, account_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
      args: [sha256(token), String(account.id), nowIso, new Date(now + SESSION_MS).toISOString()],
    });
    return { kind: 'ok' as const, account: toView(account), created: inserted.rows.length > 0 };
  });

  if (result.kind === 'limited') throw new HttpError(429, TOO_MANY, 'rate_limited');
  if (result.kind === 'failed') throw bad(BAD_CODE, 'invalid_code');
  console.log(`account_login created=${result.created}`); // no personal data in logs
  return { account: result.account, created: result.created, token };
}

async function sessionAccount(req: Request): Promise<{ id: string; view: AccountView } | null> {
  const token = sessionTokenOf(req);
  if (!token) return null; // no cookie, no database: an anonymous visit costs nothing
  const db = await getDb();
  const rs = await db.execute({
    sql:
      'SELECT a.id, a.email, a.offers_opt_in FROM account_sessions s JOIN accounts a ON a.id = s.account_id ' +
      'WHERE s.token_hash = ? AND s.expires_at > ? LIMIT 1',
    args: [sha256(token), new Date().toISOString()],
  });
  const row = rs.rows[0];
  return row ? { id: String(row.id), view: toView(row) } : null;
}

export async function currentAccount(req: Request): Promise<{ account: AccountView | null }> {
  return { account: (await sessionAccount(req))?.view ?? null };
}

export async function updateAccount(req: Request, body: Record<string, unknown>): Promise<{ account: AccountView }> {
  const session = await sessionAccount(req);
  if (!session) throw new HttpError(401, 'Please log in again.');
  if (typeof body.offersOptIn !== 'boolean') throw bad('Please choose on or off.');
  const nowIso = new Date().toISOString();
  const account = await withWriteTx(async (tx) => {
    // Only a real change writes: turning it on records fresh consent, turning it off the opt-out.
    if (body.offersOptIn) {
      await tx.execute({
        sql:
          'UPDATE accounts SET offers_opt_in = 1, offers_consent_at = ?, offers_consent_version = ?, offers_opted_out_at = NULL ' +
          'WHERE id = ? AND offers_opt_in = 0',
        args: [nowIso, OFFERS_CONSENT.version, session.id],
      });
    } else {
      await tx.execute({
        sql: 'UPDATE accounts SET offers_opt_in = 0, offers_opted_out_at = ? WHERE id = ? AND offers_opt_in = 1',
        args: [nowIso, session.id],
      });
    }
    const rs = await tx.execute({ sql: 'SELECT email, offers_opt_in FROM accounts WHERE id = ? LIMIT 1', args: [session.id] });
    return toView(rs.rows[0]);
  });
  return { account };
}

/** Read first, so a log-out with no live session never opens a write transaction. */
export async function logoutAccount(req: Request): Promise<{ success: true }> {
  const token = sessionTokenOf(req);
  if (!token) return { success: true };
  const hash = sha256(token);
  const db = await getDb();
  const found = await db.execute({ sql: 'SELECT 1 FROM account_sessions WHERE token_hash = ? LIMIT 1', args: [hash] });
  if (found.rows.length) {
    await withWriteTx((tx) => tx.execute({ sql: 'DELETE FROM account_sessions WHERE token_hash = ?', args: [hash] }));
  }
  return { success: true };
}

// --- test routes only (mounted behind testRoutes in routes.ts) ---

const TABLE_COUNTS_SQL =
  'SELECT (SELECT COUNT(*) FROM accounts) AS accounts, (SELECT COUNT(*) FROM account_sessions) AS account_sessions, ' +
  '(SELECT COUNT(*) FROM login_codes) AS login_codes, (SELECT COUNT(*) FROM rate_limits) AS rate_limits, ' +
  '(SELECT COUNT(*) FROM offers) AS offers, (SELECT COUNT(*) FROM offer_recipients) AS offer_recipients';

export const accountTestHelpers = {
  resetLimits: async ({ email, scopes, allData }: { email?: string; scopes?: string[]; allData?: boolean }) => {
    if (email && scopes) {
      const secret = requireSecret();
      await withWriteTx(async (tx) => {
        for (const scope of scopes) await tx.execute({ sql: 'DELETE FROM rate_limits WHERE key = ?', args: [limitKey(secret, scope, email)] });
      });
      return;
    }
    capOverride = null;
    await withWriteTx(async (tx) => {
      await tx.execute('DELETE FROM rate_limits');
      if (!allData) return;
      await tx.execute('DELETE FROM offer_recipients');
      await tx.execute('DELETE FROM offers');
      await tx.execute('DELETE FROM account_sessions');
      await tx.execute('DELETE FROM login_codes');
      await tx.execute('DELETE FROM accounts');
    });
  },
  row: async (email: string) => {
    const db = await getDb();
    const accounts = await db.execute({ sql: 'SELECT * FROM accounts WHERE email = ? LIMIT 1', args: [email] });
    const codes = await db.execute({ sql: 'SELECT * FROM login_codes WHERE email = ? LIMIT 1', args: [email] });
    const account = accounts.rows[0];
    const sessions = account
      ? await db.execute({ sql: 'SELECT token_hash FROM account_sessions WHERE account_id = ? LIMIT 20', args: [String(account.id)] })
      : null;
    return {
      account: account ?? null,
      loginCode: codes.rows[0] ?? null,
      sessionHashes: sessions ? sessions.rows.map((r) => String(r.token_hash)) : [],
    };
  },
  tableCounts: async () => {
    const db = await getDb();
    const row = (await db.execute(TABLE_COUNTS_SQL)).rows[0];
    return Object.fromEntries(Object.entries(row).map(([table, n]) => [table, Number(n)]));
  },
  expireCode: (email: string) =>
    withWriteTx((tx) =>
      tx.execute({ sql: 'UPDATE login_codes SET expires_at = ? WHERE email = ?', args: [new Date(Date.now() - 1000).toISOString(), email] })
    ),
  expireSessions: (email: string) =>
    withWriteTx((tx) =>
      tx.execute({
        sql: 'UPDATE account_sessions SET expires_at = ? WHERE account_id IN (SELECT id FROM accounts WHERE email = ?)',
        args: [new Date(Date.now() - 1000).toISOString(), email],
      })
    ),
  /** Sets (or with null, restores) the daily cap, and reports the counter. */
  setEmailCap: async (cap: number | null | undefined) => {
    if (cap !== undefined) capOverride = cap;
    const secret = requireSecret();
    const count = await withWriteTx(async (tx) => (await readLimit(tx, capKey(secret), Date.now())).count);
    return { cap: accountEmailCap(), count };
  },
  /** Expired rows in the three purged tables, for the bounded-batch test. */
  seedExpired: (n: number) =>
    withWriteTx(async (tx) => {
      const past = new Date(Date.now() - 1000).toISOString();
      const account = crypto.randomUUID();
      await tx.execute({
        sql: 'INSERT INTO accounts (id, email, created_at, unsubscribe_token) VALUES (?, ?, ?, ?)',
        args: [account, `purge-${account}@example.com`, past, crypto.randomBytes(32).toString('hex')],
      });
      for (let i = 0; i < n; i++) {
        const id = crypto.randomUUID();
        await tx.execute({ sql: 'INSERT INTO rate_limits (key, count, expires_at) VALUES (?, 1, ?)', args: [id, past] });
        await tx.execute({
          sql: 'INSERT INTO login_codes (email, code_hash, created_at, expires_at) VALUES (?, ?, ?, ?)',
          args: [`purge-${id}@example.com`, id, past, past],
        });
        await tx.execute({
          sql: 'INSERT INTO account_sessions (token_hash, account_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
          args: [id, account, past, past],
        });
      }
    }),
};
