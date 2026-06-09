import { getGithubContributions } from '@/lib/github-contributions';
import { getWorkouts } from '@/lib/workouts';

export const runtime = 'nodejs';
export const revalidate = 86400;

export interface HabitDay {
  date: string;
  commits: number;
  workout: boolean;
  workoutType?: 'weights' | 'padel' | 'other';
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()), 10);

  const [contributions, workouts] = await Promise.allSettled([
    getGithubContributions(year),
    getWorkouts(),
  ]);

  const commitMap = new Map<string, number>();
  if (contributions.status === 'fulfilled') {
    for (const d of contributions.value) commitMap.set(d.date, d.count);
  }

  const workoutMap = new Map<string, 'weights' | 'padel' | 'other'>();
  if (workouts.status === 'fulfilled') {
    for (const w of workouts.value) {
      const key = w.date.slice(0, 10);
      workoutMap.set(key, w.type);
    }
  }

  // Build full year grid
  const days: HabitDay[] = [];
  const start = new Date(`${year}-01-01`);
  const end = new Date(`${year}-12-31`);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const date = d.toISOString().slice(0, 10);
    const workoutType = workoutMap.get(date);
    days.push({
      date,
      commits: commitMap.get(date) ?? 0,
      workout: workoutMap.has(date),
      workoutType,
    });
  }

  return new Response(JSON.stringify(days), {
    headers: { 'Content-Type': 'application/json' },
  });
}
