export const runtime = 'nodejs';

export async function POST(req: Request) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID ?? 'VR6AewLTigWG4xSOukaG'; // Arnold fallback

  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'NO_KEY' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let text: string;
  try {
    ({ text } = await req.json());
    if (!text || typeof text !== 'string') throw new Error('invalid');
  } catch {
    return new Response(JSON.stringify({ error: 'invalid body' }), { status: 400 });
  }

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_turbo_v2_5',
      voice_settings: { stability: 0.6, similarity_boost: 0.8, style: 0.2, use_speaker_boost: true },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('ElevenLabs error:', err);
    return new Response(JSON.stringify({ error: 'tts_failed' }), { status: 502 });
  }

  const audio = await res.arrayBuffer();
  return new Response(audio, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'no-store',
    },
  });
}
