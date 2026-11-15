/**
 * The cancellation rule (owner-approved 2026-11-14), shared by the server (backend/bookings.ts), Manage
 * booking and the Refund and cancellation page. Pure: no `@/` alias, no `import.meta.env`.
 *
 * - 24 hours' notice or more: free, the class or trial comes back.
 * - Less than 24 hours but not on the day of the class (Dubai time): moved once, so the class comes back
 *   the first time; a second late move from the same pack (or trial) is charged.
 * - On the day of the class: charged, the class or trial counts as used.
 */
export const FREE_CANCEL_HOURS = 24;

/** Dubai is UTC+4 all year (no daylight saving). */
const DUBAI_OFFSET_MS = 4 * 60 * 60 * 1000;
const dubaiDay = (ms: number) => new Date(ms + DUBAI_OFFSET_MS).toISOString().slice(0, 10);

export type CancelTier = 'free' | 'move' | 'late';

/** Which rule applies, before knowing whether the one late move is already used. */
export function cancelTier(startUtcMs: number, nowMs: number): CancelTier {
  const noticeHours = (startUtcMs - nowMs) / (60 * 60 * 1000);
  if (noticeHours >= FREE_CANCEL_HOURS) return 'free';
  return dubaiDay(startUtcMs) === dubaiDay(nowMs) ? 'late' : 'move';
}

/** Pack validity in days (10-pack 45, 20-pack 75): about 10 classes a month. */
export const PACK_VALID_DAYS = { pack10: 45, pack20: 75 } as const;
