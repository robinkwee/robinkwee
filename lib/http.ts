import 'server-only';
import { type CoreMessage } from 'ai';

/**
 * Shared request helpers for the API routes.
 */

/**
 * Best-effort client IP.
 *
 * On Vercel the platform appends the real client IP to `x-forwarded-for`, so
 * the FIRST entry is client-controlled and the LAST is the one the edge saw.
 * Prefer `x-real-ip`, which Vercel sets itself, and fall back to the last
 * forwarded hop — never the first, which a caller can spoof to dodge limits.
 */
export function clientIp(req: Request): string {
  const realIp = req.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;

  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const hops = forwarded
      .split(',')
      .map((h) => h.trim())
      .filter(Boolean);
    if (hops.length > 0) return hops[hops.length - 1];
  }

  return 'unknown';
}

export function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...(init.headers ?? {}),
    },
  });
}

export function tooManyRequests(retryAfterSeconds: number, message: string): Response {
  return json(
    { error: message },
    {
      status: 429,
      headers: { 'Retry-After': String(retryAfterSeconds) },
    }
  );
}

export const MAX_MESSAGE_CHARS = 2_000;
export const MAX_MESSAGES = 40;

/**
 * Accept only what a browser chat client can legitimately send.
 *
 * The routes used to forward the request body to the model verbatim, so a
 * caller could inject `role: 'system'` turns to rewrite the persona, or
 * fabricate `tool` results to convince the agent a booking had already
 * happened. Roles are whitelisted and content is coerced to bounded text.
 */
export function sanitizeMessages(input: unknown): CoreMessage[] | null {
  if (!Array.isArray(input) || input.length === 0) return null;

  const messages: CoreMessage[] = [];

  for (const raw of input.slice(-MAX_MESSAGES)) {
    if (!raw || typeof raw !== 'object') continue;
    const { role, content } = raw as { role?: unknown; content?: unknown };
    if (role !== 'user' && role !== 'assistant') continue;

    const text = typeof content === 'string' ? content : '';
    const trimmed = text.slice(0, MAX_MESSAGE_CHARS).trim();
    if (!trimmed) continue;

    messages.push({ role, content: trimmed });
  }

  return messages.length > 0 ? messages : null;
}
