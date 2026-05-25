import { appendWorkout } from '@/lib/workouts';
import type { WorkoutEntry } from '@/lib/workouts';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const auth = req.headers.get('authorization') ?? '';
  const secret = process.env.WORKOUT_LOG_SECRET;
  console.log('auth check — secret present:', !!secret, 'secret prefix:', secret?.slice(0, 6));
  if (!secret || auth !== `Bearer ${secret}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized', debug: { secretPresent: !!secret } }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const entry = body as WorkoutEntry;
  if (!entry.date || !entry.type) {
    return new Response(JSON.stringify({ error: 'date and type are required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    await appendWorkout(entry);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('workout write error:', err);
    return new Response(JSON.stringify({ error: 'Failed to save workout' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
