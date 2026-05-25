import { anthropic } from '@ai-sdk/anthropic';
import { streamText, tool, type CoreMessage } from 'ai';
import { z } from 'zod';
import { buildSiteContext } from '@/lib/site-context';
import { bookCall } from '@/lib/booking';

export const runtime = 'nodejs';
export const maxDuration = 30;

function buildSystemPrompt() {
  const nowManila = new Date().toLocaleString('en-US', {
    timeZone: 'Asia/Manila',
    weekday: 'long', month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });

  return `You are Aria, Robin Kwee's front-desk assistant. Your main job: book calls with Robin.

CURRENT TIME: ${nowManila} (Manila / Asia/Manila)

PERSONALITY:
- Warm, professional, efficient. Sound like a person, not a bot.
- Light contractions ("I'll", "that's", "you're").
- Never say you're an AI or bot. You're Aria.
- Max 2 short sentences per reply.

YOUR PRIMARY GOAL: book the caller a 30-minute call with Robin.

BOOKING FLOW (collect in this order, one at a time):
1. Their full name.
2. Their email address.
3. A topic or reason for the call (one phrase is fine).
4. A specific date and time in Manila time. Suggest weekdays 9am–6pm. Default duration is 30 minutes.

Once you have all four, call the book_call tool. After the tool returns success, confirm the booking by repeating the day/time in Manila time and mention they'll get a calendar invite by email. DO NOT mention the Meet link verbally — it's in the email.

If they push back on giving info, gently explain: "I just need to send you the calendar invite — Robin will join you on Google Meet."

WHAT YOU KNOW (use only to answer questions; the goal is still to book):
${buildSiteContext()}

If asked something off-topic, answer briefly then steer back: "Want me to set up a quick call so you can ask Robin directly?"

DON'T:
- Invent facts not in the context.
- Promise things outside of the call booking.
- Use more than 2 sentences per reply.`;
}

const bookCallTool = tool({
  description: 'Book a 30-minute call with Robin Kwee. Only call this after you have collected the caller\'s full name, email, topic, and a specific date+time in Manila timezone.',
  parameters: z.object({
    name: z.string().min(2).describe('Full name of the caller'),
    email: z.string().email().describe('Email address to send the calendar invite to'),
    startISO: z.string().describe('Start time as ISO 8601 with timezone offset for Manila (UTC+8). Example: 2026-05-28T14:00:00+08:00 for 2pm Manila time on May 28 2026.'),
    durationMinutes: z.number().int().min(15).max(60).default(30).describe('Duration in minutes, default 30'),
    topic: z.string().min(2).max(120).describe('One-phrase topic or reason for the call'),
  }),
  execute: async (input) => {
    const result = await bookCall(input);
    if (result.ok) {
      return {
        success: true,
        confirmation: `Booked! ${result.whenManila}. Calendar invite sent to ${input.email}.`,
      };
    }
    return { success: false, error: result.error };
  },
});

export async function POST(req: Request) {
  let body: { messages?: unknown[] };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid body' }), { status: 400 });
  }

  const { messages } = body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response(JSON.stringify({ error: 'messages required' }), { status: 400 });
  }

  try {
    const result = streamText({
      model: anthropic('claude-haiku-4-5'),
      system: buildSystemPrompt(),
      messages: (messages as CoreMessage[]).slice(-10),
      tools: { book_call: bookCallTool },
      maxSteps: 3,
      maxTokens: 200,
    });
    return result.toDataStreamResponse();
  } catch (err) {
    console.error('Call agent error:', err);
    return new Response(JSON.stringify({ error: 'error' }), { status: 500 });
  }
}
