/**
 * Time helpers. All "minutes" in Gnaver are minutes-from-local-midnight,
 * so 9:30 → 570. Dates are ISO yyyy-mm-dd strings, treated as local to the
 * destination (we never depend on the device timezone for scheduling).
 */

/** Clamp a number into [min, max]. */
export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/** 570 → "09:30". Handles values past midnight (1530 → "01:30 +1"). */
export function formatMinutes(totalMinutes: number): string {
  const wrapped = ((totalMinutes % 1440) + 1440) % 1440;
  const extraDays = Math.floor(totalMinutes / 1440);
  const h = Math.floor(wrapped / 60);
  const m = Math.round(wrapped % 60);
  const base = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  return extraDays > 0 ? `${base} +${extraDays}` : base;
}

/** "09:30" → 570. Returns NaN for malformed input. */
export function parseMinutes(hhmm: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!match) return NaN;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return NaN;
  return h * 60 + m;
}

/** Day-of-week (0 = Sunday … 6 = Saturday) for an ISO date, timezone-safe. */
export function dayOfWeek(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number);
  // Construct in UTC to avoid the device timezone shifting the day.
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Add `n` days to an ISO date and return a new ISO date. */
export function addDays(isoDate: string, n: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

/** Build a contiguous list of ISO dates starting at `startIso` for `count` days. */
export function dateRange(startIso: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addDays(startIso, i));
}

/** Humanise a duration in minutes: 95 → "1h 35m", 40 → "40m". */
export function formatDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Metres → friendly string: 850 → "850 m", 3200 → "3.2 km". */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(meters < 10_000 ? 1 : 0)} km`;
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** "2026-06-16" → "Tue, Jun 16". */
export function formatDateLabel(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const wd = WEEKDAY_LABELS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${wd}, ${MONTH_LABELS[m - 1]} ${d}`;
}
