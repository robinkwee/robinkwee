export const runtime = 'nodejs';

// Server-side TTS cascade: try human-sounding models first, fall back to reliable ones.
// All free via HF Inference API. Returns audio/wav binary on success.

const MODELS = [
  // Kokoro: best human quality but may not be on standard inference API
  { id: 'hexgrad/Kokoro-82M', useVoice: true, name: 'kokoro' },
  // MMS-TTS: reliable Facebook TTS, decent quality, always works on HF free
  { id: 'facebook/mms-tts-eng', useVoice: false, name: 'mms' },
  // SpeechT5: Microsoft's natural-sounding TTS
  { id: 'microsoft/speecht5_tts', useVoice: false, name: 'speecht5' },
];

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

  for (const model of MODELS) {
    const body: Record<string, unknown> = { inputs: text };
    if (model.useVoice) body.parameters = { voice };

    try {
      const hfRes = await fetch(
        `https://api-inference.huggingface.co/models/${model.id}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${hfToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        }
      );

      const contentType = hfRes.headers.get('content-type') ?? '';

      // 503 cold-start: model is loading. Skip and try next model (no point waiting 20s
      // for Kokoro if MMS-TTS is warm and ready).
      if (hfRes.status === 503) {
        console.log(`[tts] ${model.name} cold-starting, trying next`);
        continue;
      }

      // Non-200: try next model
      if (!hfRes.ok) {
        const errText = await hfRes.text().catch(() => '');
        console.log(`[tts] ${model.name} failed ${hfRes.status}: ${errText.slice(0, 200)}`);
        continue;
      }

      // Got JSON instead of audio = error response (model unsupported, etc)
      if (contentType.includes('application/json')) {
        const errBody = await hfRes.json().catch(() => ({}));
        console.log(`[tts] ${model.name} returned JSON:`, errBody);
        continue;
      }

      // Got audio - return it
      const audio = await hfRes.arrayBuffer();
      console.log(`[tts] ${model.name} succeeded (${audio.byteLength} bytes, ${contentType})`);
      return new Response(audio, {
        headers: {
          'Content-Type': contentType || 'audio/wav',
          'X-TTS-Model': model.name,
          'Cache-Control': 'no-store',
        },
      });
    } catch (err) {
      console.log(`[tts] ${model.name} threw:`, err);
      continue;
    }
  }

  // All models failed
  return new Response(JSON.stringify({ error: 'all_tts_failed' }), {
    status: 502,
    headers: { 'Content-Type': 'application/json' },
  });
}
