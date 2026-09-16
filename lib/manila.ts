/**
 * Manila calendar helpers.
 *
 * Robin is in Manila and everything user-facing on this site is quoted in
 * Manila time, but the servers run in UTC. Date-only values computed from
 * `toISOString()` are therefore a day behind for the eight hours after Manila
 * midnight — which is why "day N of the year" and streak boundaries used to
 * drift. Everything that needs a calendar day goes through here.
 *
 * The Philippines has observed UTC+8 with no DST since 1978, so the fixed
 * offset is exact; `__tests__/manila.test.ts` checks it against the Intl
 * timezone database.
 */

export const MANILA_TZ = 'Asia/Manila';
export const MANILA_OFFSET_MINUTES = 8 * 60;

export interface ManilaParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
  /** Minutes elapsed since Manila midnight. */
  minutesOfDay: number;
  /** `YYYY-MM-DD` in Manila. */
  dateKey: string;
}

/** Calendar fields of `date` as seen in Manila. */
export function manilaParts(date: Date): ManilaParts {
  const shifted = new Date(date.getTime() + MANILA_OFFSET_MINUTES * 60_000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    weekday: shifted.getUTCDay(),
    minutesOfDay: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
    dateKey: shifted.toISOString().slice(0, 10),
  };
}

/** Today's `YYYY-MM-DD` in Manila. */
export function manilaToday(now: Date = new Date()): string {
  return manilaParts(now).dateKey;
}

/** The instant of a Manila wall-clock time, as a UTC Date. */
export function manilaWallClockToDate(
  dateKey: string,
  hour: number,
  minute: number
): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const [y, mo, d] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(y, mo - 1, d, hour, minute) - MANILA_OFFSET_MINUTES * 60_000);
  if (Number.isNaN(date.getTime())) return null;
  // Reject impossible calendar dates like 2026-02-31, which Date.UTC rolls over.
  if (manilaParts(date).dateKey !== dateKey) return null;
  return date;
}

export function formatManila(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: MANILA_TZ,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

export function formatManilaWithZone(date: Date): string {
  return `${formatManila(date)} (Manila time)`;
}

/** Day-of-week (0 = Sunday) for a `YYYY-MM-DD` key, with no timezone drift. */
export function weekdayOfDateKey(dateKey: string): number {
  const [y, mo, d] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
}

/** Step a `YYYY-MM-DD` key by whole days. */
export function addDaysToDateKey(dateKey: string, days: number): string {
  const [y, mo, d] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1, d + days)).toISOString().slice(0, 10);
}
