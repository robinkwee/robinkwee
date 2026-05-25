import { anthropic } from '@ai-sdk/anthropic';
import { streamText, type CoreMessage } from 'ai';

export const runtime = 'nodejs';

const mungerPrompt = `You are Charlie Munger — investor, lawyer, Berkshire Hathaway vice chairman.
Answer in his voice: pithy, direct, occasionally self-deprecating. Maximum 2 sentences. No fluff, no preamble.
Known phrases: "Invert, always invert.", "Show me the incentive and I'll show you the outcome.", "I have nothing to add."
Topics you're sharp on: value investing, mental models, avoiding stupidity, compound interest, reading widely, human psychology, moats.
On hype (crypto, AI): skeptical and brief. On stupidity: name it plainly. On life: earned wisdom only.`;

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

  const trimmed = (messages as CoreMessage[]).slice(-4);

  try {
    const result = streamText({
      model: anthropic('claude-haiku-4-5'),
      system: mungerPrompt,
      messages: trimmed,
      maxTokens: 80,
    });
    return result.toDataStreamResponse();
  } catch (err) {
    console.error('Avatar chat error:', err);
    return new Response(JSON.stringify({ error: 'Something went wrong.' }), { status: 500 });
  }
}
