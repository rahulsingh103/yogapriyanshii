import type { Row } from '@libsql/client';
import { getDb, withWriteTx } from './db.js';
import {
  HttpError,
  MEMBER_STATUSES,
  UUID_RE,
  bad,
  isoDateOrNull,
  oneOf,
  type MemberFormat,
  type MemberStatus,
} from './validate.js';

// The monthly membership: a "Join the membership" contact message also stores one
// membership_requests row (004), which Priyanshi moves New -> Contacted -> Active in the admin.

export const MEMBERSHIP_INTEREST = 'Monthly membership';

/** The plan as the server knows it. Each request snapshots the label and price. */
export const MEMBERSHIP_PLAN = { key: 'monthly12', label: '12-class monthly membership', priceAed: 2999 } as const;

export const PAGE_SIZE = 20;
const MAX_PAGE = 1000;
const START_DATE_WINDOW_DAYS = 365;

const FORMAT_LABELS: Record<MemberFormat, string> = { in_person: 'In person in Dubai', online: 'Live online' };

const aed = (n: number) => `AED ${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;

/** The extra alert lines for a membership request (after "Interest"). */
export function membershipAlertDetails(format: MemberFormat | null): string[] {
  const lines = [`• Plan: ${MEMBERSHIP_PLAN.label} (${aed(MEMBERSHIP_PLAN.priceAed)} a month)`];
  if (format) lines.push(`• Format: ${FORMAT_LABELS[format]}`);
  return lines;
}

/** Today's date in Dubai as YYYY-MM-DD. */
export function dubaiToday(now: number = Date.now()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai' }).format(new Date(now));
}

/** One step forward or back, plus active -> active to edit the start date. No New -> Active jump. */
const TRANSITIONS: Record<MemberStatus, readonly MemberStatus[]> = {
  new: ['contacted'],
  contacted: ['new', 'active'],
  active: ['contacted', 'active'],
};

export function canTransition(from: MemberStatus, to: MemberStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export interface MemberView {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  planKey: string;
  planLabel: string;
  priceAed: number;
  format: MemberFormat | null;
  preferredTimes: string;
  status: MemberStatus;
  startDate: string | null;
  requestedAt: string;
  updatedAt: string;
}

const MEMBER_SELECT =
  'SELECT m.message_id, m.plan_key, m.plan_label, m.price_aed, m.format, m.status, m.start_date, m.created_at, ' +
  'm.updated_at, c.name, c.email, c.phone, c.message ' +
  'FROM membership_requests m JOIN contact_messages c ON c.id = m.message_id';

export function toMemberView(r: Row): MemberView {
  return {
    id: String(r.message_id),
    name: String(r.name),
    email: String(r.email),
    phone: r.phone == null ? null : String(r.phone),
    planKey: String(r.plan_key),
    planLabel: String(r.plan_label),
    priceAed: Number(r.price_aed),
    format: r.format == null ? null : (String(r.format) as MemberFormat),
    preferredTimes: String(r.message ?? ''),
    status: String(r.status) as MemberStatus,
    startDate: r.start_date == null ? null : String(r.start_date),
    requestedAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

/** `?page=` and `?status=` as Express parsed them. Arrays and objects are refused. */
export function parseMembersQuery(query: Record<string, unknown>): { page: number; status: MemberStatus | null } {
  let page = 1;
  if (query.page !== undefined) {
    const p = query.page;
    if (typeof p !== 'string' || !/^\d{1,4}$/.test(p) || Number(p) < 1 || Number(p) > MAX_PAGE) {
      throw bad('Please choose a page from 1 to 1000.');
    }
    page = Number(p);
  }
  let status: MemberStatus | null = null;
  if (query.status !== undefined && query.status !== '') {
    status = oneOf(query.status, MEMBER_STATUSES);
    if (!status) throw bad('Please choose a valid status.');
  }
  return { page, status };
}

export async function listMembers({ page, status }: { page: number; status: MemberStatus | null }) {
  const db = await getDb();
  // One read transaction, so the page and the counts come from the same snapshot.
  const [rows, grouped] = await db.batch(
    [
      {
        sql: `${MEMBER_SELECT} WHERE (? IS NULL OR m.status = ?) ORDER BY m.created_at DESC, m.message_id DESC LIMIT ? OFFSET ?`,
        args: [status, status, PAGE_SIZE, (page - 1) * PAGE_SIZE],
      },
      'SELECT status, COUNT(*) AS n FROM membership_requests GROUP BY status',
    ],
    'read'
  );
  const counts: Record<MemberStatus, number> = { new: 0, contacted: 0, active: 0 };
  for (const r of grouped.rows) {
    const s = oneOf(r.status, MEMBER_STATUSES);
    if (s) counts[s] = Number(r.n);
  }
  const total = status ? counts[status] : counts.new + counts.contacted + counts.active;
  return { members: rows.rows.map(toMemberView), page, pageSize: PAGE_SIZE, total, counts };
}

const NOT_FOUND = 'Membership request not found.';
const STALE = 'This request was updated elsewhere. Refresh to see the latest.';

function daysBetween(a: string, b: string): number {
  const t = (s: string) => {
    const [y, m, d] = s.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round(Math.abs(t(a) - t(b)) / 86_400_000);
}

/** Moves one request along New -> Contacted -> Active. The server checks the step, the date and staleness. */
export async function updateMember(id: unknown, body: Record<string, unknown>): Promise<{ member: MemberView }> {
  if (typeof id !== 'string' || !UUID_RE.test(id)) throw new HttpError(404, NOT_FOUND);
  const status = oneOf(body.status, MEMBER_STATUSES);
  const expectedStatus = oneOf(body.expectedStatus, MEMBER_STATUSES);
  if (!status || !expectedStatus) throw bad('Please choose a valid status.');
  if (!canTransition(expectedStatus, status)) throw bad("That status change isn't allowed.");

  let startDate: string | null = null;
  if (status === 'active') {
    startDate = isoDateOrNull(body.startDate);
    if (!startDate || daysBetween(startDate, dubaiToday()) > START_DATE_WINDOW_DAYS) {
      throw bad('Please enter a valid start date.');
    }
  } else if (body.startDate !== undefined && body.startDate !== null && body.startDate !== '') {
    throw bad('A start date is only set when the membership is active.');
  }

  const member = await withWriteTx(async (tx) => {
    const current = await tx.execute({ sql: 'SELECT status FROM membership_requests WHERE message_id = ? LIMIT 1', args: [id] });
    if (!current.rows.length) throw new HttpError(404, NOT_FOUND);
    const from = oneOf(current.rows[0].status, MEMBER_STATUSES);
    if (from !== expectedStatus) throw new HttpError(409, STALE);
    if (!canTransition(from, status)) throw bad("That status change isn't allowed.");
    // Leaving Active clears the start date (the table's CHECK ties the two together).
    const updated = await tx.execute({
      sql: 'UPDATE membership_requests SET status = ?, start_date = ?, updated_at = ? WHERE message_id = ? AND status = ?',
      args: [status, startDate, new Date().toISOString(), id, from],
    });
    if (updated.rowsAffected === 0) throw new HttpError(409, STALE);
    const rs = await tx.execute({ sql: `${MEMBER_SELECT} WHERE m.message_id = ? LIMIT 1`, args: [id] });
    return toMemberView(rs.rows[0]);
  });
  console.log(`member_updated id=${id} status=${status}`); // no personal data in logs
  return { member };
}
