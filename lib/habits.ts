import { addDaysToDateKey, manilaToday, weekdayOfDateKey } from './manila';

/**
 * Shared shape and maths for the activity log, used by both `/log` and
 * `/api/habits` so the page and the API can never disagree.
 */

export type WorkoutType = 'weights' | 'padel' | 'other';

export interface HabitDay {
  date: string;
  commits: number;
  workout: boolean;
  workoutType?: WorkoutType;
}

export interface Streaks {
  code: number;
  workout: number;
  full: number;
}

/** Bound the `year` query parameter to something a calendar can be built for. */
export function normalizeYear(raw: string | null, now: Date = new Date()): number {
  const currentYear = Number(manilaToday(now).slice(0, 4));
  const parsed = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(parsed)) return currentYear;
  return Math.min(Math.max(parsed, 2000), currentYear + 1);
}

/** Every calendar day of `year`, in order. */
export function daysOfYear(year: number): string[] {
  const days: string[] = [];
  let cursor = `${year}-01-01`;
  const end = `${year}-12-31`;
  while (cursor <= end) {
    days.push(cursor);
    cursor = addDaysToDateKey(cursor, 1);
  }
  return days;
}

export function buildHabitDays(
  year: number,
  commits: Map<string, number>,
  workouts: Map<string, WorkoutType>
): HabitDay[] {
  return daysOfYear(year).map((date) => ({
    date,
    commits: commits.get(date) ?? 0,
    workout: workouts.has(date),
    workoutType: workouts.get(date),
  }));
}

/**
 * Current streaks, counting back from today.
 *
 * The previous implementation flipped a counter's sign to mean "stopped", but
 * `-0 >= 0` is true in JavaScript, so a streak of zero never stopped and a
 * stopped streak flipped straight back to positive on the next miss. A day off
 * therefore reported the *previous* run as the current streak. An explicit
 * "still counting" flag has no such edge.
 */
export function computeStreaks(days: HabitDay[], today = manilaToday()): Streaks {
  const past = days.filter((d) => d.date <= today).sort((a, b) => a.date.localeCompare(b.date));

  const streaks: Streaks = { code: 0, workout: 0, full: 0 };
  const counting = { code: true, workout: true, full: true };

  for (let i = past.length - 1; i >= 0; i--) {
    const day = past[i];
    const hit = {
      code: day.commits > 0,
      workout: day.workout,
      full: day.commits > 0 && day.workout,
    };

    for (const key of ['code', 'workout', 'full'] as const) {
      if (!counting[key]) continue;
      if (hit[key]) streaks[key] += 1;
      else counting[key] = false;
    }

    if (!counting.code && !counting.workout && !counting.full) break;
  }

  return streaks;
}

/** Counts since Monday of the current week. */
export function weeklyStats(days: HabitDay[], today = manilaToday()) {
  const weekday = weekdayOfDateKey(today);
  const monday = addDaysToDateKey(today, -((weekday + 6) % 7));
  const week = days.filter((d) => d.date >= monday && d.date <= today);

  return {
    code: week.filter((d) => d.commits > 0).length,
    workout: week.filter((d) => d.workout).length,
    full: week.filter((d) => d.commits > 0 && d.workout).length,
  };
}

/** Calendar grid of weeks, padded so each column starts on a Sunday. */
export function buildGrid(year: number, days: HabitDay[]): (HabitDay | null)[][] {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const cells: (HabitDay | null)[] = Array(weekdayOfDateKey(`${year}-01-01`)).fill(null);
  for (const date of daysOfYear(year)) cells.push(byDate.get(date) ?? null);

  const weeks: (HabitDay | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
