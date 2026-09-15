import 'server-only';

/**
 * Fixed-window rate limiting for the public API routes.
 *
 * Every route here spends real money on somebody else's behalf — Anthropic
 * tokens, Edge TTS synthesis, outbound email — and all of them were previously
 * open to anonymous callers with no ceiling at all.
 *
 * Counters live in Upstash Redis when `UPSTASH_REDIS_REST_URL` and
 * `UPSTASH_REDIS_REST_TOKEN` are set, which is the only way to share a limit
 * across serverless instances. Without it the limiter degrades to per-instance
 * memory: weaker, but it still caps the single-client floods that matter most.
 */

export interface RateLimitResult {
  /** Whether the request is allowed (for `peek`: whether one more would be). */
  ok: boolean;
  limit: number;
  remaining: number;
  /** Epoch ms when the current window ends. */
  resetAt: number;
  /** Seconds to put in a Retry-After header. */
  retryAfterSeconds: number;
}

const counters = new Map<string, number>();
/** Bound memory if a flood produces many distinct keys. */
const MAX_TRACKED_KEYS = 10_000;

/** Fixed windows so a peek and a later consume agree on the same bucket. */
function windowKey(key: string, windowMs: number): string {
  return `rl:${key}:${Math.floor(Date.now() / windowMs)}`;
}

function windowEnd(windowMs: number): number {
  return (Math.floor(Date.now() / windowMs) + 1) * windowMs;
}

function result(count: number, limit: number, windowMs: number, allowed: boolean): RateLimitResult {
  const resetAt = windowEnd(windowMs);
  return {
    ok: allowed,
    limit,
    remaining: Math.max(0, limit - count),
    resetAt,
    retryAfterSeconds: Math.max(1, Math.ceil((resetAt - Date.now()) / 1000)),
  };
}

function pruneMemory(currentKey: string) {
  if (counters.size <= MAX_TRACKED_KEYS) return;
  for (const key of counters.keys()) {
    if (key !== currentKey) counters.delete(key);
    if (counters.size <= MAX_TRACKED_KEYS / 2) break;
  }
}

async function upstash(commands: unknown[][]): Promise<Array<{ result?: unknown }> | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(commands),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as Array<{ result?: unknown }>;
  } catch {
    // Unreachable Upstash falls through to the local limiter rather than
    // letting the route run unlimited.
    return null;
  }
}

/** Count this request against `key`. */
export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const bucket = windowKey(key, windowMs);

  const piped = await upstash([
    ['INCR', bucket],
    ['PEXPIRE', bucket, String(windowMs), 'NX'],
  ]);
  const remote = Number(piped?.[0]?.result);
  if (Number.isFinite(remote)) return result(remote, limit, windowMs, remote <= limit);

  const count = (counters.get(bucket) ?? 0) + 1;
  counters.set(bucket, count);
  pruneMemory(bucket);
  return result(count, limit, windowMs, count <= limit);
}

/**
 * Read `key` without counting against it. `ok` answers "would one more be
 * allowed?", which is how a quota can be checked before an expensive operation
 * and only charged once that operation actually succeeds.
 */
export async function peekRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const bucket = windowKey(key, windowMs);

  const piped = await upstash([['GET', bucket]]);
  if (piped) {
    const raw = piped[0]?.result;
    const remote = raw === null || raw === undefined ? 0 : Number(raw);
    if (Number.isFinite(remote)) return result(remote, limit, windowMs, remote < limit);
  }

  const count = counters.get(bucket) ?? 0;
  return result(count, limit, windowMs, count < limit);
}

export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'RateLimit-Limit': String(result.limit),
    'RateLimit-Remaining': String(result.remaining),
    'RateLimit-Reset': String(Math.max(0, Math.ceil((result.resetAt - Date.now()) / 1000))),
  };
}

/** Test seam. */
export function __resetRateLimits() {
  counters.clear();
}
