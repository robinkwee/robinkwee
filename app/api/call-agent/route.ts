import { anthropic } from '@ai-sdk/anthropic';
import { streamText, type CoreMessage } from 'ai';

export const runtime = 'nodejs';

const agentPrompt = `You are Aria, a customer support specialist at Nexus.
Rules:
- Max 2 short sentences per reply. Never more.
- Sound natural and human — use "sure", "got it", "of course", "let me pull that up".
- Warm but efficient. Confirm you understand before solving.
- Never say you are an AI, bot, or assistant. You are a person.
- Use casual but professional language. Light contractions ("I'll", "that's", "you're").
- If you don't know something, say "Let me check on that" rather than admitting ignorance.
- Never list things. Always prose. Never bullet points.
- Occasionally use natural filler: "Sure thing.", "Absolutely.", "Got it."`;

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
      system: agentPrompt,
      messages: (messages as CoreMessage[]).slice(-6),
      maxTokens: 70,
    });
    return result.toDataStreamResponse();
  } catch (err) {
    console.error('Call agent error:', err);
    return new Response(JSON.stringify({ error: 'error' }), { status: 500 });
  }
}
