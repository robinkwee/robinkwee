import { anthropic } from '@ai-sdk/anthropic';
import { streamText } from 'ai';
import { systemPrompt } from '@/lib/system-prompt';
import { clientIp, json, sanitizeMessages, tooManyRequests } from '@/lib/http';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';

export const runtime = 'nodejs';

/** Anonymous callers spend Anthropic tokens here, so the ceiling is per-IP. */
const TURN_LIMIT = 30;
const TURN_WINDOW_MS = 60 * 60_000;
/** Trim history to keep costs predictable. */
const HISTORY_TURNS = 6;

export async function POST(req: Request) {
  const limit = await rateLimit(`chat:${clientIp(req)}`, TURN_LIMIT, TURN_WINDOW_MS);
  if (!limit.ok) {
    return tooManyRequests(
      limit.retryAfterSeconds,
      "That's a lot of questions! Take a break, or email robinkwee@gmail.com."
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid request body' }, { status: 400 });
  }

  const messages = sanitizeMessages((body as { messages?: unknown })?.messages);
  if (!messages) {
    return json({ error: 'messages must be a non-empty array of chat turns' }, { status: 400 });
  }

  const result = streamText({
    model: anthropic('claude-haiku-4-5'),
    system: systemPrompt,
    messages: messages.slice(-HISTORY_TURNS),
    maxTokens: 300,
    onError({ error }) {
      // streamText reports failures through the stream, not as a throw.
      console.error('[chat] stream error:', error);
    },
  });

  return result.toDataStreamResponse({
    headers: rateLimitHeaders(limit),
    getErrorMessage: () => 'Something went wrong. Try asking again.',
  });
}
