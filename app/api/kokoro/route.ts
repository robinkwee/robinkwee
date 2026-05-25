export const runtime = 'nodejs';

// Kokoro-82M via HF Inference API — free, genuinely human-sounding
// Voices: af_heart, af_bella, af_nicole, am_adam, am_michael, bf_emma, bm_george
// Get a free HF token at huggingface.co/settings/tokens

export async function POST(req: Request) {
  const hfToken = process.env.HF_TOKEN;

  if (!hfToken) {
    return new Response(JSON.stringify({ error: 'NO_KEY' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let text: string;
  let voice: string;
  try {
    ({ text, voice = 'af_heart' } = await req.json());
    if (!text?.trim()) throw new Error('empty');
  } catch {
    return new Response(JSON.stringify({ error: 'invalid body' }), { status: 400 });
  }

  const hfRes = await fetch(
    'https://api-inference.huggingface.co/models/hexgrad/Kokoro-82M',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${hfToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs: text, parameters: { voice } }),
    }
  );

  // 503 = model cold-starting; client should retry after ~20s
  if (hfRes.status === 503) {
    const body = await hfRes.json().catch(() => ({}));
    return new Response(
      JSON.stringify({ error: 'MODEL_LOADING', estimated_time: (body as Record<string, number>).estimated_time ?? 20 }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!hfRes.ok) {
    const err = await hfRes.text();
    console.error('Kokoro error:', hfRes.status, err);
    return new Response(JSON.stringify({ error: 'tts_failed' }), { status: 502 });
  }

  const audio = await hfRes.arrayBuffer();
  const contentType = hfRes.headers.get('content-type') ?? 'audio/flac';

  return new Response(audio, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'no-store',
    },
  });
}
