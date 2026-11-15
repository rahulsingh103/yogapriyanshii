import crypto from 'crypto';
import { getConfig } from './config.js';
import { getDb, withWriteTx } from './db.js';
import { offerFooter, sendOfferEmail } from './email.js';
import { HttpError, UUID_RE, bad, cleanText } from './validate.js';

// Opt-in offer emails, sent from the admin Offers tab. The browser drives short calls, so no Vercel
// timeout can lose more than the one recipient in flight, and that recipient is never sent to again:
// at most once beats a duplicate. Email never goes out inside a write transaction.

export const OFFER_BATCH_MAX = 10;
export const OFFER_BATCH_MS = 4000;
export const OFFER_PACE_MS = 1000;
/** Provisional, like the account email cap: leaves room for booking email on the assumed 100-a-day plan. */
export const OFFER_DAILY_CAP = 50;
/** Longer than the 5s send timeout: a row still "sending" after this was interrupted. */
const INTERRUPTED_MS = 30 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_LIMIT = 10;

let dailyOverride: number | null = null; // test routes only
const dailyCap = () => dailyOverride ?? OFFER_DAILY_CAP;
export const setOfferDailyLimitForTests = (limit: number | null) => {
  dailyOverride = limit;
};

const NOT_FOUND = 'Offer not found.';
const ALREADY_SENDING = 'Another offer is still sending. Finish it first.';
const NO_SUBSCRIBERS = 'There are no subscribers yet.';
export const OFFERS_UNAVAILABLE = "Offers aren't available right now.";

export interface OfferSummary {
  id: string;
  subject: string;
  status: 'sending' | 'done';
  createdAt: string;
  finishedAt: string | null;
  sent: number;
  failed: number;
  skipped: number;
  /** Not sent yet, including any in flight. */
  remaining: number;
}

const SUMMARY_COLUMNS =
  "o.id, o.subject, o.status, o.created_at, o.finished_at, " +
  "COALESCE(SUM(r.status = 'sent'), 0) AS sent, COALESCE(SUM(r.status = 'failed'), 0) AS failed, " +
  "COALESCE(SUM(r.status = 'skipped'), 0) AS skipped, COALESCE(SUM(r.status IN ('pending', 'sending')), 0) AS remaining";

const toSummary = (r: Record<string, unknown>): OfferSummary => ({
  id: String(r.id),
  subject: String(r.subject),
  status: String(r.status) === 'sending' ? 'sending' : 'done',
  createdAt: String(r.created_at),
  finishedAt: r.finished_at == null ? null : String(r.finished_at),
  sent: Number(r.sent),
  failed: Number(r.failed),
  skipped: Number(r.skipped),
  remaining: Number(r.remaining),
});

async function summaryOf(id: string): Promise<OfferSummary> {
  const db = await getDb();
  const rs = await db.execute({
    sql: `SELECT ${SUMMARY_COLUMNS} FROM offers o LEFT JOIN offer_recipients r ON r.offer_id = o.id WHERE o.id = ? GROUP BY o.id LIMIT 1`,
    args: [id],
  });
  if (!rs.rows.length) throw new HttpError(404, NOT_FOUND);
  return toSummary(rs.rows[0]);
}

export async function offersOverview() {
  const db = await getDb();
  const [subscribers, recent] = await db.batch(
    [
      'SELECT COUNT(*) AS n FROM accounts WHERE offers_opt_in = 1',
      {
        sql:
          `SELECT ${SUMMARY_COLUMNS} FROM (SELECT * FROM offers ORDER BY created_at DESC, id DESC LIMIT ?) o ` +
          'LEFT JOIN offer_recipients r ON r.offer_id = o.id GROUP BY o.id ORDER BY o.created_at DESC, o.id DESC',
        args: [RECENT_LIMIT],
      },
    ],
    'read'
  );
  const offers = recent.rows.map(toSummary);
  return {
    subscribers: Number(subscribers.rows[0].n),
    // One send at a time, and it blocks new offers, so a running offer is always the newest.
    current: offers.find((o) => o.status === 'sending') ?? null,
    offers,
    /** The footer every offer email ends with, so the review shows the exact email. */
    footer: offerFooter('(their own unsubscribe link)'),
  };
}

/** Takes the recipients at this moment. Only verified, opted-in accounts ever exist here. */
export async function createOffer(body: Record<string, unknown>): Promise<{ offer: OfferSummary }> {
  const subject = cleanText(body.subject, 120, { singleLine: true });
  if (!subject) throw bad('Please write a one-line subject of up to 120 characters.');
  const text = cleanText(body.body, 5000);
  if (!text) throw bad('Please write a message of up to 5,000 characters.');

  const id = crypto.randomUUID();
  const nowIso = new Date().toISOString();
  try {
    await withWriteTx(async (tx) => {
      const active = await tx.execute("SELECT id FROM offers WHERE status = 'sending' LIMIT 1");
      if (active.rows.length) throw new HttpError(409, ALREADY_SENDING);
      const subs = await tx.execute('SELECT COUNT(*) AS n FROM accounts WHERE offers_opt_in = 1');
      if (Number(subs.rows[0].n) === 0) throw bad(NO_SUBSCRIBERS);
      await tx.execute({
        sql: "INSERT INTO offers (id, subject, body, status, created_at) VALUES (?, ?, ?, 'sending', ?)",
        args: [id, subject, text, nowIso],
      });
      await tx.execute({
        sql: "INSERT INTO offer_recipients (offer_id, account_id, status) SELECT ?, id, 'pending' FROM accounts WHERE offers_opt_in = 1",
        args: [id],
      });
    });
  } catch (err) {
    // Two offers racing: the partial unique index stops the second.
    if (/UNIQUE constraint/i.test((err as Error)?.message ?? '')) throw new HttpError(409, ALREADY_SENDING);
    throw err;
  }
  console.log(`offer_created id=${id}`);
  return { offer: await summaryOf(id) };
}

type Claim =
  | { kind: 'claimed'; accountId: string; email: string; unsubscribeToken: string }
  | { kind: 'paused' }
  | { kind: 'empty' };

/** One recipient, atomically: concurrent batches can never take the same row. */
function claimNext(offerId: string): Promise<Claim> {
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  return withWriteTx(async (tx) => {
    await tx.execute({
      sql: "UPDATE offer_recipients SET status = 'failed', sent_at = claimed_at WHERE offer_id = ? AND status = 'sending' AND claimed_at < ?",
      args: [offerId, new Date(now - INTERRUPTED_MS).toISOString()],
    });
    // Unsubscribed since the snapshot.
    await tx.execute({
      sql:
        "UPDATE offer_recipients SET status = 'skipped' WHERE offer_id = ? AND status = 'pending' " +
        'AND account_id IN (SELECT id FROM accounts WHERE offers_opt_in = 0)',
      args: [offerId],
    });
    const next = await tx.execute({
      sql:
        'SELECT r.account_id, a.email, a.unsubscribe_token FROM offer_recipients r JOIN accounts a ON a.id = r.account_id ' +
        "WHERE r.offer_id = ? AND r.status = 'pending' LIMIT 1",
      args: [offerId],
    });
    const row = next.rows[0];
    if (!row) return { kind: 'empty' as const };

    // A failed send may still have used quota, so it counts too.
    const used = await tx.execute({
      sql: "SELECT COUNT(*) AS n FROM offer_recipients WHERE (status IN ('sent', 'failed') AND sent_at > ?) OR status = 'sending'",
      args: [new Date(now - DAY_MS).toISOString()],
    });
    if (Number(used.rows[0].n) >= dailyCap()) return { kind: 'paused' as const };

    await tx.execute({
      sql: "UPDATE offer_recipients SET status = 'sending', claimed_at = ? WHERE offer_id = ? AND account_id = ? AND status = 'pending'",
      args: [nowIso, offerId, String(row.account_id)],
    });
    return {
      kind: 'claimed' as const,
      accountId: String(row.account_id),
      email: String(row.email),
      unsubscribeToken: String(row.unsubscribe_token),
    };
  });
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** One short call: up to OFFER_BATCH_MAX sends or OFFER_BATCH_MS, paced. The browser calls again. */
export async function sendOfferBatch(id: unknown): Promise<{ offer: OfferSummary; paused: boolean }> {
  if (typeof id !== 'string' || !UUID_RE.test(id)) throw new HttpError(404, NOT_FOUND);
  const db = await getDb();
  const rs = await db.execute({ sql: 'SELECT subject, body, status FROM offers WHERE id = ? LIMIT 1', args: [id] });
  const offer = rs.rows[0];
  if (!offer) throw new HttpError(404, NOT_FOUND);
  if (String(offer.status) === 'done') return { offer: await summaryOf(id), paused: false };

  const started = Date.now();
  let sends = 0;
  let paused = false;
  while (sends < OFFER_BATCH_MAX && Date.now() - started < OFFER_BATCH_MS) {
    if (sends > 0) await sleep(OFFER_PACE_MS);
    const claim = await claimNext(id);
    if (claim.kind !== 'claimed') {
      paused = claim.kind === 'paused';
      break;
    }
    const delivered = await sendOfferEmail({
      to: claim.email,
      subject: String(offer.subject),
      body: String(offer.body),
      unsubscribeToken: claim.unsubscribeToken,
    });
    await withWriteTx((tx) =>
      tx.execute({
        sql: "UPDATE offer_recipients SET status = ?, sent_at = ? WHERE offer_id = ? AND account_id = ? AND status = 'sending'",
        args: [delivered ? 'sent' : 'failed', new Date().toISOString(), id, claim.accountId],
      })
    );
    sends += 1;
  }

  await withWriteTx((tx) =>
    tx.execute({
      sql:
        "UPDATE offers SET status = 'done', finished_at = ? WHERE id = ? AND status = 'sending' " +
        "AND NOT EXISTS (SELECT 1 FROM offer_recipients WHERE offer_id = ? AND status IN ('pending', 'sending'))",
      args: [new Date().toISOString(), id, id],
    })
  );
  return { offer: await summaryOf(id), paused };
}

const TOKEN_RE = /^[0-9a-f]{64}$/;

export const isUnsubscribeToken = (value: unknown): value is string => typeof value === 'string' && TOKEN_RE.test(value);

/** No login and no Origin check: the token is 256 random bits. A repeat is still a success. */
export async function unsubscribe(token: unknown): Promise<{ success: true; message: string }> {
  const notFound = new HttpError(404, "This link doesn't work.");
  if (!isUnsubscribeToken(token)) throw notFound;
  // Read first: an unknown token or a repeat never opens a write transaction.
  const db = await getDb();
  const rs = await db.execute({ sql: 'SELECT offers_opt_in FROM accounts WHERE unsubscribe_token = ? LIMIT 1', args: [token] });
  const found = rs.rows.length > 0;
  if (found && Number(rs.rows[0].offers_opt_in) === 1) {
    await withWriteTx((tx) =>
      tx.execute({
        sql: 'UPDATE accounts SET offers_opt_in = 0, offers_opted_out_at = ? WHERE unsubscribe_token = ? AND offers_opt_in = 1',
        args: [new Date().toISOString(), token],
      })
    );
  }
  if (!found) throw notFound;
  console.log('offers_unsubscribed'); // no personal data in logs
  return { success: true, message: "You're unsubscribed." };
}

// --- test routes only ---

/** Leaves one recipient looking like a send cut off mid-call, long enough ago to count as interrupted. */
export const interruptOneRecipientForTests = (offerId: string) =>
  withWriteTx((tx) =>
    tx.execute({
      sql:
        "UPDATE offer_recipients SET status = 'sending', claimed_at = ? WHERE offer_id = ? AND account_id = " +
        "(SELECT account_id FROM offer_recipients WHERE offer_id = ? AND status = 'pending' LIMIT 1)",
      args: [new Date(Date.now() - INTERRUPTED_MS - 1000).toISOString(), offerId, offerId],
    })
  );
