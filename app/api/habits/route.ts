import { getGithubContributions } from '@/lib/github-contributions';
import { getWorkouts } from '@/lib/workouts';

export const runtime = 'nodejs';
export const revalidate = 86400;

export interface HabitDay {
  date: string;
  commits: number;
  workout: boolean;
  workoutType?: 'weights' | 'padel' | 'other';
  calories: number | null;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()), 10);

  const [contributions, workouts, calories] = await Promise.allSettled([
    getGithubContributions(year),
    getWorkouts(),
    fetchCalories(year),
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

  const calorieMap = new Map<string, number | null>();
  if (calories.status === 'fulfilled' && calories.value) {
    for (const c of calories.value) calorieMap.set(c.date, c.calories);
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
      calories: calorieMap.get(date) ?? null,
    });
  }

  return new Response(JSON.stringify(days), {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function fetchCalories(year: number): Promise<{ date: string; calories: number }[] | null> {
  const url = process.env.JARVIS_EXPORT_URL;
  const key = process.env.JARVIS_API_KEY;
  if (!url || !key) return null;

  try {
    const res = await fetch(
      `${url}?from=${year}-01-01&to=${year}-12-31`,
      { headers: { 'x-api-key': key }, next: { revalidate: 86400 } }
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
