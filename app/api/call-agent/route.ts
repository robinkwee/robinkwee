import { anthropic } from '@ai-sdk/anthropic';
import { streamText, tool } from 'ai';
import { z } from 'zod';
import { buildSiteContext } from '@/lib/site-context';
import { bookCall } from '@/lib/booking';
import {
  ALLOWED_DURATIONS,
  BUSINESS_END_HOUR,
  BUSINESS_START_HOUR,
  DEFAULT_DURATION_MINUTES,
  MANILA_TZ,
  MAX_DAYS_AHEAD,
  MIN_LEAD_MINUTES,
  normalizeSpokenEmail,
} from '@/lib/booking/schema';
import { clientIp, json, sanitizeMessages, tooManyRequests } from '@/lib/http';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const maxDuration = 30;

/** Each turn costs model tokens and can trigger an email. */
const TURN_LIMIT = 40;
const TURN_WINDOW_MS = 60 * 60_000;
const HISTORY_TURNS = 12;

function buildSystemPrompt() {
  const nowManila = new Date().toLocaleString('en-US', {
    timeZone: MANILA_TZ,
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  return `You are Aria, Robin Kwee's front-desk assistant. Your main job: book calls with Robin.

CURRENT TIME: ${nowManila} (Manila / Asia/Manila)

PERSONALITY:
- Warm, professional, efficient. Sound like a person, not a bot.
- Light contractions ("I'll", "that's", "you're").
- Never say you're an AI or bot. You're Aria.
- Max 2 short sentences per reply.

BOOKING FLOW (collect in this order, one at a time):
1. Their full name.
2. Their email address. This is spoken aloud and transcribed, so ALWAYS read it
   back and get a clear yes before you book. If they say "at" or "dot", spell the
   address back the way it will be written.
3. A topic or reason for the call (one phrase is fine).
4. A specific date and time in Manila time.

BOOKING RULES (these are enforced — a slot outside them will be rejected):
- Weekdays only, ${BUSINESS_START_HOUR}:00 to ${BUSINESS_END_HOUR}:00 Manila time.
- Start times are on the hour or the half hour.
- At least ${MIN_LEAD_MINUTES} minutes from now, and within ${MAX_DAYS_AHEAD} days.
- Duration is ${DEFAULT_DURATION_MINUTES} minutes unless they ask otherwise.

Once you have all four AND the caller has confirmed the email, call the book_call
tool. If the tool returns an error, tell the caller what went wrong in one short
sentence and offer the nearest workable option — never claim a call is booked
unless the tool returned success. After success, confirm the day and time in
Manila time and mention the calendar invite by email. DO NOT read the meeting
link aloud — it's in the email.

If the caller would rather type than talk, tell them the booking form is on the
same page, just below the call controls.

WHAT YOU KNOW (use only to answer questions; the goal is still to book):
${buildSiteContext()}

If asked something off-topic, answer briefly then steer back: "Want me to set up a quick call so you can ask Robin directly?"

DON'T:
- Invent facts not in the context.
- Promise things outside of the call booking.
- Claim a booking succeeded when the tool reported an error.
- Use more than 2 sentences per reply.`;
}

const bookCallTool = tool({
  description:
    "Book a call with Robin Kwee. Only call this after you have the caller's full name, " +
    'a confirmed email address, a topic, and a specific date+time in Manila time.',
  parameters: z.object({
    name: z.string().describe('Full name of the caller'),
    email: z.string().describe('Email address to send the calendar invite to'),
    startISO: z
      .string()
      .describe(
        'Start time as ISO 8601 with the Manila offset (+08:00). ' +
          'Example: 2026-05-28T14:00:00+08:00 for 2pm Manila time on May 28 2026.'
      ),
    durationMinutes: z
      .number()
      .int()
      .default(DEFAULT_DURATION_MINUTES)
      .describe(`Duration in minutes, one of ${ALLOWED_DURATIONS.join(', ')}`),
    topic: z.string().describe('One-phrase topic or reason for the call'),
  }),
  execute: async (input) => {
    const result = await bookCall(
      { ...input, email: normalizeSpokenEmail(input.email) },
      { source: 'voice' }
    );

    if (result.ok) {
      return {
        success: true as const,
        bookingRef: result.bookingRef,
        whenManila: result.whenManila,
        confirmation: `Booked for ${result.whenManila}. Calendar invite sent to ${input.email}.`,
      };
    }

    return {
      success: false as const,
      code: result.code,
      // Aria reads this back to the caller, so it has to be a usable sentence.
      error: result.error,
    };
  },
});

export async function POST(req: Request) {
  const limit = await rateLimit(`call-agent:${clientIp(req)}`, TURN_LIMIT, TURN_WINDOW_MS);
  if (!limit.ok) {
    return tooManyRequests(
      limit.retryAfterSeconds,
      "We've hit the limit for this session. Please use the booking form or email robinkwee@gmail.com."
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const messages = sanitizeMessages((body as { messages?: unknown })?.messages);
  if (!messages) {
    return json({ error: 'messages must be a non-empty array of chat turns.' }, { status: 400 });
  }

  const result = streamText({
    model: anthropic('claude-haiku-4-5'),
    system: buildSystemPrompt(),
    messages: messages.slice(-HISTORY_TURNS),
    tools: { book_call: bookCallTool },
    maxSteps: 4,
    maxTokens: 400,
    onError({ error }) {
      // streamText surfaces failures through the stream, not as a throw.
      console.error('[call-agent] stream error:', error);
    },
  });

  return result.toDataStreamResponse({
    headers: rateLimitHeaders(limit),
    getErrorMessage: () =>
      "Sorry — I lost that. Could you say it again, or use the booking form below?",
  });
}
