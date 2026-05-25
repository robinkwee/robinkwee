import 'server-only';
import { createClient } from '@supabase/supabase-js';

export interface Exercise {
  name: string;
  sets: number;
  reps: number;
  kg: number;
}

export interface WorkoutEntry {
  date: string; // YYYY-MM-DD
  type: 'weights' | 'padel' | 'other';
  exercises?: Exercise[];
  duration_min?: number;
  result?: 'W' | 'L' | null;
  notes?: string;
}

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function appendWorkout(entry: WorkoutEntry): Promise<void> {
  const { error } = await getSupabase().from('workouts').insert({
    date: entry.date,
    type: entry.type,
    exercises: entry.exercises ?? null,
    duration_min: entry.duration_min ?? null,
    result: entry.result ?? null,
    notes: entry.notes ?? null,
  });
  if (error) throw new Error(`Supabase insert failed: ${error.message}`);
}

export async function getWorkouts(): Promise<WorkoutEntry[]> {
  const { data, error } = await getSupabase()
    .from('workouts')
    .select('*')
    .order('date', { ascending: false });
  if (error) throw new Error(`Supabase read failed: ${error.message}`);
  return data as WorkoutEntry[];
}
