import { getGithubContributions } from '@/lib/github-contributions';
import { getWorkouts } from '@/lib/workouts';
import { buildHabitDays, normalizeYear, type HabitDay, type WorkoutType } from '@/lib/habits';
import { json } from '@/lib/http';

export const runtime = 'nodejs';
export const revalidate = 86400;

export type { HabitDay };

export async function GET(req: Request) {
  // `year` is caller-controlled: without a bound, a value like 99999 built an
  // invalid date and an unbounded loop.
  const year = normalizeYear(new URL(req.url).searchParams.get('year'));

  const [contributions, workouts] = await Promise.allSettled([
    getGithubContributions(year),
    getWorkouts(),
  ]);

  const commitMap = new Map<string, number>();
  if (contributions.status === 'fulfilled') {
    for (const d of contributions.value) commitMap.set(d.date, d.count);
  } else {
    console.error('[habits] GitHub contributions failed:', contributions.reason);
  }

  const workoutMap = new Map<string, WorkoutType>();
  if (workouts.status === 'fulfilled') {
    for (const w of workouts.value) workoutMap.set(w.date.slice(0, 10), w.type);
  } else {
    console.error('[habits] workouts read failed:', workouts.reason);
  }

  return json(buildHabitDays(year, commitMap, workoutMap), {
    headers: { 'Cache-Control': 'public, max-age=0, s-maxage=86400' },
  });
}
