// Admin dates, always on the studio's calendar (Dubai), whatever the device's time zone.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** YYYY-MM-DD of an instant, in Dubai. */
export function dubaiYmd(at: Date | string = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai' }).format(typeof at === 'string' ? new Date(at) : at);
}

/** "25 Oct 2026" from YYYY-MM-DD. */
export function formatDay(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}
