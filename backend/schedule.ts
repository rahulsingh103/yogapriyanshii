import type { Row } from '@libsql/client';
import { getDb, withWriteTx } from './db.js';

// Dubai is UTC+4 all year (no daylight saving), so a fixed offset is exact.
const DUBAI_OFFSET_MS = 4 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
export const SCHEDULE_DAYS = 56;
const ENSURE_EVERY_MS = 10 * 60 * 1000;

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Same shape as `ClassSession` in src/types/index.ts. */
export interface SessionView {
  id: string;
  classId: string;
  className: string;
  style: 'hatha' | 'barre' | 'wheel' | 'chakra';
  level: string;
  duration: number;
  startTimeUtc: string;
  dateDubai: string;
  timeDubai: string;
  capacity: number;
  bookedCount: number;
  spotsLeft: number;
  status: 'available' | 'full' | 'past';
  isRestDay?: boolean;
}

interface TemplateRow {
  weekday: number;
  startTime: string;
  classId: string;
  capacity: number;
}

/** Midnight (Dubai) of the Dubai calendar day containing `ms`, as a UTC timestamp. */
export function dubaiDayStartUtc(ms: number): number {
  const d = new Date(ms + DUBAI_OFFSET_MS);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - DUBAI_OFFSET_MS;
}

export function formatDubaiDate(iso: string): string {
  const d = new Date(new Date(iso).getTime() + DUBAI_OFFSET_MS);
  return `${DAY_NAMES[d.getUTCDay()]}, ${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

export function formatDubaiTime(iso: string): string {
  const d = new Date(new Date(iso).getTime() + DUBAI_OFFSET_MS);
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

export function formatDubaiWhen(iso: string): string {
  return `${formatDubaiDate(iso)} at ${formatDubaiTime(iso)}`;
}

/** Dubai month label ("May") and key ("2026-05") for a UTC timestamp. */
export function dubaiMonth(ms: number): { key: string; label: string; startUtc: number } {
  const d = new Date(ms + DUBAI_OFFSET_MS);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  return {
    key: `${y}-${String(m + 1).padStart(2, '0')}`,
    label: MONTH_NAMES[m],
    startUtc: Date.UTC(y, m, 1) - DUBAI_OFFSET_MS,
  };
}

function sessionId(classId: string, startUtcMs: number): string {
  return `sess-${classId}-${startUtcMs}`;
}

function slotUtcMs(dayStartUtc: number, startTime: string): number {
  const [h, m] = startTime.split(':').map(Number);
  return dayStartUtc + (h * 60 + m) * 60 * 1000;
}

async function loadTemplate(): Promise<TemplateRow[]> {
  const db = await getDb();
  const rs = await db.execute(
    'SELECT weekday, start_time, class_id, capacity FROM schedule_template ORDER BY weekday, start_time LIMIT 50'
  );
  return rs.rows.map((r) => ({
    weekday: Number(r.weekday),
    startTime: String(r.start_time),
    classId: String(r.class_id),
    capacity: Number(r.capacity),
  }));
}

function weekdayOf(dayStartUtc: number): number {
  return new Date(dayStartUtc + DUBAI_OFFSET_MS).getUTCDay();
}

let lastEnsured = 0;
let ensuring: Promise<void> | null = null;

/** Creates any missing sessions for the next 56 Dubai days. Idempotent; runs at most every 10 minutes. */
export async function ensureSessions(now = Date.now()): Promise<void> {
  if (now - lastEnsured < ENSURE_EVERY_MS && dubaiDayStartUtc(now) === dubaiDayStartUtc(lastEnsured)) return;
  if (ensuring) return ensuring;
  ensuring = (async () => {
    const template = await loadTemplate();
    const today = dubaiDayStartUtc(now);
    const inserts: { sql: string; args: (string | number)[] }[] = [];
    for (let offset = 0; offset < SCHEDULE_DAYS; offset++) {
      const day = today + offset * DAY_MS;
      for (const t of template.filter((x) => x.weekday === weekdayOf(day))) {
        const start = slotUtcMs(day, t.startTime);
        inserts.push({
          sql: 'INSERT OR IGNORE INTO sessions (id, class_id, start_utc, capacity) VALUES (?, ?, ?, ?)',
          args: [sessionId(t.classId, start), t.classId, new Date(start).toISOString(), t.capacity],
        });
      }
    }
    if (inserts.length) await withWriteTx((tx) => tx.batch(inserts));
    lastEnsured = now;
  })().finally(() => {
    ensuring = null;
  });
  return ensuring;
}

export function toSessionView(r: Row, now = Date.now()): SessionView {
  const startIso = String(r.start_utc);
  const capacity = Number(r.capacity);
  const booked = Number(r.booked_count);
  const cancelled = String(r.session_status) === 'cancelled';
  const spotsLeft = cancelled ? 0 : Math.max(0, capacity - booked);
  const past = new Date(startIso).getTime() <= now;
  return {
    id: String(r.id),
    classId: String(r.class_id),
    className: String(r.class_name),
    style: String(r.style) as SessionView['style'],
    level: String(r.level),
    duration: Number(r.duration_min),
    startTimeUtc: startIso,
    dateDubai: formatDubaiDate(startIso),
    timeDubai: formatDubaiTime(startIso),
    capacity,
    bookedCount: booked,
    spotsLeft,
    status: past ? 'past' : spotsLeft === 0 ? 'full' : 'available',
    isRestDay: false,
  };
}

function restDay(dayStartUtc: number): SessionView {
  const iso = new Date(dayStartUtc).toISOString();
  const local = new Date(dayStartUtc + DUBAI_OFFSET_MS).toISOString().slice(0, 10);
  return {
    id: `sess-rest-${local}`,
    classId: 'rest',
    className: 'Rest Day',
    style: 'hatha',
    level: '—',
    duration: 0,
    startTimeUtc: iso,
    dateDubai: formatDubaiDate(iso),
    timeDubai: '—',
    capacity: 0,
    bookedCount: 0,
    spotsLeft: 0,
    status: 'past',
    isRestDay: true,
  };
}

/** Exactly one entry per Dubai day for 56 days, starting today; days without a class are rest placeholders. */
export async function listSchedule(now = Date.now()): Promise<SessionView[]> {
  await ensureSessions(now);
  const template = await loadTemplate();
  const today = dubaiDayStartUtc(now);
  const end = today + SCHEDULE_DAYS * DAY_MS;
  const db = await getDb();
  const rs = await db.execute({
    sql:
      'SELECT s.id, s.class_id, s.start_utc, s.capacity, s.booked_count, s.status AS session_status, c.name AS class_name, c.style, c.level, c.duration_min ' +
      'FROM sessions s JOIN classes c ON c.id = s.class_id WHERE s.start_utc >= ? AND s.start_utc < ? ORDER BY s.start_utc LIMIT 60',
    args: [new Date(today).toISOString(), new Date(end).toISOString()],
  });
  const byId = new Map(rs.rows.map((r) => [String(r.id), r]));

  const out: SessionView[] = [];
  for (let offset = 0; offset < SCHEDULE_DAYS; offset++) {
    const day = today + offset * DAY_MS;
    const slot = template.find((t) => t.weekday === weekdayOf(day));
    const row = slot ? byId.get(sessionId(slot.classId, slotUtcMs(day, slot.startTime))) : undefined;
    out.push(row ? toSessionView(row, now) : restDay(day));
  }
  return out;
}

/** The next `limit` upcoming sessions (admin dashboard). */
export async function upcomingSessions(limit: number, now = Date.now()): Promise<SessionView[]> {
  await ensureSessions(now);
  const db = await getDb();
  const rs = await db.execute({
    sql:
      'SELECT s.id, s.class_id, s.start_utc, s.capacity, s.booked_count, s.status AS session_status, c.name AS class_name, c.style, c.level, c.duration_min ' +
      "FROM sessions s JOIN classes c ON c.id = s.class_id WHERE s.start_utc > ? AND s.status = 'scheduled' ORDER BY s.start_utc LIMIT ?",
    args: [new Date(now).toISOString(), Math.min(limit, 50)],
  });
  return rs.rows.map((r) => toSessionView(r, now));
}

/** Test-only (APP_ENV=test): a one-off wheel session starting `minutesFromNow` from now. Not shown in the schedule. */
export async function createAdhocSession(minutesFromNow: number): Promise<SessionView> {
  const start = Math.floor((Date.now() + minutesFromNow * 60 * 1000) / 60000) * 60000 + 7 * 1000;
  const id = sessionId('wheel', start);
  await withWriteTx((tx) =>
    tx.execute({
      sql: "INSERT OR IGNORE INTO sessions (id, class_id, start_utc, capacity) VALUES (?, 'wheel', ?, 10)",
      args: [id, new Date(start).toISOString()],
    })
  );
  const db = await getDb();
  const rs = await db.execute({
    sql:
      'SELECT s.id, s.class_id, s.start_utc, s.capacity, s.booked_count, s.status AS session_status, c.name AS class_name, c.style, c.level, c.duration_min ' +
      'FROM sessions s JOIN classes c ON c.id = s.class_id WHERE s.id = ? LIMIT 1',
    args: [id],
  });
  return toSessionView(rs.rows[0]);
}
