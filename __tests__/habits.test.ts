import { describe, it, expect } from 'vitest';
import {
  buildGrid,
  buildHabitDays,
  computeStreaks,
  daysOfYear,
  normalizeYear,
  weeklyStats,
  type HabitDay,
} from '../lib/habits';

function days(spec: Array<[date: string, commits: number, workout: boolean]>): HabitDay[] {
  return spec.map(([date, commits, workout]) => ({ date, commits, workout }));
}

describe('normalizeYear', () => {
  const now = new Date('2026-09-15T02:00:00Z');

  it('defaults to the current Manila year', () => {
    expect(normalizeYear(null, now)).toBe(2026);
    expect(normalizeYear('', now)).toBe(2026);
    expect(normalizeYear('garbage', now)).toBe(2026);
  });

  it('clamps years that would build an invalid or enormous calendar', () => {
    expect(normalizeYear('99999', now)).toBe(2027);
    expect(normalizeYear('-5', now)).toBe(2000);
    expect(normalizeYear('1066', now)).toBe(2000);
  });

  it('accepts a plausible year', () => {
    expect(normalizeYear('2025', now)).toBe(2025);
  });
});

describe('daysOfYear', () => {
  it('covers the whole year, leap years included', () => {
    expect(daysOfYear(2026)).toHaveLength(365);
    expect(daysOfYear(2028)).toHaveLength(366);
    expect(daysOfYear(2026)[0]).toBe('2026-01-01');
    expect(daysOfYear(2026).at(-1)).toBe('2026-12-31');
  });
});

describe('computeStreaks', () => {
  it('counts an unbroken run up to today', () => {
    const streaks = computeStreaks(
      days([
        ['2026-09-12', 3, true],
        ['2026-09-13', 1, true],
        ['2026-09-14', 2, true],
        ['2026-09-15', 5, true],
      ]),
      '2026-09-15'
    );
    expect(streaks).toEqual({ code: 4, workout: 4, full: 4 });
  });

  it('reports zero when today is a miss, not the previous run', () => {
    // The old sign-flip sentinel relied on `-0 >= 0` being false. It is true,
    // so a day off reported the run before it as the *current* streak.
    const streaks = computeStreaks(
      days([
        ['2026-09-12', 3, true],
        ['2026-09-13', 4, true],
        ['2026-09-14', 2, true],
        ['2026-09-15', 0, false],
      ]),
      '2026-09-15'
    );
    expect(streaks).toEqual({ code: 0, workout: 0, full: 0 });
  });

  it('does not restart a streak once it has been broken', () => {
    // Same sentinel bug: after breaking, the counter flipped back positive and
    // resumed counting older days.
    const streaks = computeStreaks(
      days([
        ['2026-09-10', 9, true],
        ['2026-09-11', 9, true],
        ['2026-09-12', 9, true],
        ['2026-09-13', 0, false],
        ['2026-09-14', 1, true],
        ['2026-09-15', 1, true],
      ]),
      '2026-09-15'
    );
    expect(streaks).toEqual({ code: 2, workout: 2, full: 2 });
  });

  it('tracks each streak independently', () => {
    const streaks = computeStreaks(
      days([
        ['2026-09-13', 1, true],
        ['2026-09-14', 1, false],
        ['2026-09-15', 1, true],
      ]),
      '2026-09-15'
    );
    expect(streaks).toEqual({ code: 3, workout: 1, full: 1 });
  });

  it('ignores days in the future, which are always empty', () => {
    const streaks = computeStreaks(
      days([
        ['2026-09-14', 1, true],
        ['2026-09-15', 1, true],
        ['2026-09-16', 0, false],
        ['2026-12-31', 0, false],
      ]),
      '2026-09-15'
    );
    expect(streaks).toEqual({ code: 2, workout: 2, full: 2 });
  });

  it('handles an empty year', () => {
    expect(computeStreaks([], '2026-09-15')).toEqual({ code: 0, workout: 0, full: 0 });
  });
});

describe('weeklyStats', () => {
  it('counts from Monday of the current week', () => {
    // 2026-09-15 is a Tuesday, so the week starts on the 14th.
    const stats = weeklyStats(
      days([
        ['2026-09-13', 5, true], // Sunday — previous week
        ['2026-09-14', 1, true],
        ['2026-09-15', 2, false],
        ['2026-09-16', 9, true], // tomorrow
      ]),
      '2026-09-15'
    );
    expect(stats).toEqual({ code: 2, workout: 1, full: 1 });
  });

  it('treats Sunday as the end of its week, not the start', () => {
    // 2026-09-20 is a Sunday; its week began Monday the 14th.
    const stats = weeklyStats(
      days([
        ['2026-09-14', 1, true],
        ['2026-09-20', 1, true],
      ]),
      '2026-09-20'
    );
    expect(stats.code).toBe(2);
  });
});

describe('buildHabitDays / buildGrid', () => {
  it('merges commits and workouts onto the calendar', () => {
    const result = buildHabitDays(
      2026,
      new Map([['2026-01-02', 4]]),
      new Map([['2026-01-03', 'padel' as const]])
    );
    expect(result[0]).toEqual({ date: '2026-01-01', commits: 0, workout: false, workoutType: undefined });
    expect(result[1]).toMatchObject({ date: '2026-01-02', commits: 4, workout: false });
    expect(result[2]).toMatchObject({ date: '2026-01-03', workout: true, workoutType: 'padel' });
  });

  it('pads the grid so every column starts on a Sunday', () => {
    const grid = buildGrid(2026, buildHabitDays(2026, new Map(), new Map()));
    // 2026-01-01 is a Thursday, so four leading blanks.
    expect(grid[0].slice(0, 4)).toEqual([null, null, null, null]);
    expect(grid[0][4]?.date).toBe('2026-01-01');
    expect(grid.every((week) => week.length <= 7)).toBe(true);
    expect(grid.flat().filter(Boolean)).toHaveLength(365);
  });
});
