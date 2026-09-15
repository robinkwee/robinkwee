import { timingSafeEqual } from 'crypto';
import { z } from 'zod';
import { appendWorkout } from '@/lib/workouts';
import { clientIp, json, tooManyRequests } from '@/lib/http';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

const ATTEMPT_LIMIT = 30;
const ATTEMPT_WINDOW_MS = 60 * 60_000;

const exerciseSchema = z.object({
  name: z.string().trim().min(1).max(80),
  sets: z.number().int().min(0).max(100),
  reps: z.number().int().min(0).max(1000),
  kg: z.number().min(0).max(1000),
});

const workoutSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  type: z.enum(['weights', 'padel', 'other']),
  exercises: z.array(exerciseSchema).max(50).optional(),
  duration_min: z.number().int().min(0).max(1440).optional(),
  result: z.enum(['W', 'L']).nullish(),
  notes: z.string().trim().max(1000).optional(),
});

/** Constant-time compare so the secret cannot be recovered byte by byte. */
function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, 'utf-8');
  const b = Buffer.from(expected, 'utf-8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  const limit = await rateLimit(`workout:${clientIp(req)}`, ATTEMPT_LIMIT, ATTEMPT_WINDOW_MS);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSeconds, 'Too many requests.');

  const secret = process.env.WORKOUT_LOG_SECRET;
  const provided = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');

  // The 401 body and the server log used to reveal whether the secret was
  // configured and its first six characters. Neither says anything now.
  if (!secret || !provided || !secretMatches(provided, secret)) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = workoutSchema.safeParse(body);
  if (!parsed.success) {
    return json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid workout entry' },
      { status: 400 }
    );
  }

  try {
    await appendWorkout(parsed.data);
    return json({ ok: true });
  } catch (err) {
    console.error('workout write error:', err);
    return json({ error: 'Failed to save workout' }, { status: 500 });
  }
}
