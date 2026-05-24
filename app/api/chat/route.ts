import { openai } from '@ai-sdk/openai';
import { streamText, type CoreMessage } from 'ai';
import { systemPrompt } from '@/lib/system-prompt';

export const runtime = 'edge';

export async function POST(req: Request) {
  let body: { messages?: unknown[] };

  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { messages } = body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response(JSON.stringify({ error: 'messages must be a non-empty array' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Trim history to last 6 messages to keep costs predictable
  const trimmed = (messages as CoreMessage[]).slice(-6);

  try {
    const result = streamText({
      model: openai('gpt-4o-mini'),
      system: systemPrompt,
      messages: trimmed,
      maxTokens: 300,
    });

    return result.toDataStreamResponse();
  } catch (err) {
    console.error('OpenAI error:', err);
    return new Response(
      JSON.stringify({ error: "Something went wrong. Try asking again." }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
