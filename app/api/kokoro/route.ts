import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

export const runtime = 'nodejs';
export const maxDuration = 30;

// Microsoft Edge TTS (Azure Neural Voices) — free, no API key, ~300ms latency.
// Aria is Microsoft's call-center-tuned voice.
// HF cascade kept as fallback if Edge endpoint is ever unreachable.

const EDGE_VOICE = 'en-US-AriaNeural';

const HF_MODELS = [
  { id: 'facebook/mms-tts-eng', name: 'mms' },
  { id: 'microsoft/speecht5_tts', name: 'speecht5' },
];

async function tryEdgeTTS(text: string): Promise<Buffer | null> {
  try {
    const tts = new MsEdgeTTS();
    await tts.setMetadata(EDGE_VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    const { audioStream } = tts.toStream(text);

    const chunks: Buffer[] = [];
    return await new Promise<Buffer | null>((resolve) => {
      const timeout = setTimeout(() => resolve(null), 12000);
      audioStream.on('data', (chunk: Buffer) => chunks.push(chunk));
      audioStream.on('end', () => {
        clearTimeout(timeout);
        resolve(Buffer.concat(chunks));
      });
      audioStream.on('error', () => {
        clearTimeout(timeout);
        resolve(null);
      });
    });
  } catch (err) {
    console.log('[tts] edge failed:', err);
    return null;
  }
}

async function tryHF(text: string, hfToken: string): Promise<{ audio: ArrayBuffer; contentType: string; name: string } | null> {
  for (const model of HF_MODELS) {
    try {
      const res = await fetch(
        `https://api-inference.huggingface.co/models/${model.id}`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${hfToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ inputs: text }),
        }
      );
      const ct = res.headers.get('content-type') ?? '';
      if (!res.ok || ct.includes('application/json')) {
        console.log(`[tts] ${model.name} skipped (${res.status} ${ct})`);
        continue;
      }
      const audio = await res.arrayBuffer();
      return { audio, contentType: ct || 'audio/wav', name: model.name };
    } catch (err) {
      console.log(`[tts] ${model.name} threw:`, err);
    }
  }
  return null;
}

export async function POST(req: Request) {
  let text: string;
  try {
    ({ text } = await req.json());
    if (!text?.trim()) throw new Error('empty');
  } catch {
    return new Response(JSON.stringify({ error: 'invalid body' }), { status: 400 });
  }

  // 1. Edge TTS (Aria Neural) — primary
  const edgeAudio = await tryEdgeTTS(text);
  if (edgeAudio) {
    return new Response(new Uint8Array(edgeAudio), {
      headers: {
        'Content-Type': 'audio/mpeg',
        'X-TTS-Model': 'aria-neural',
        'Cache-Control': 'no-store',
      },
    });
  }

  // 2. HF cascade fallback (only if HF_TOKEN present)
  const hfToken = process.env.HF_TOKEN;
  if (hfToken) {
    const hfResult = await tryHF(text, hfToken);
    if (hfResult) {
      return new Response(hfResult.audio, {
        headers: {
          'Content-Type': hfResult.contentType,
          'X-TTS-Model': hfResult.name,
          'Cache-Control': 'no-store',
        },
      });
    }
  }

  // 3. Nothing worked — client falls back to Web Speech
  return new Response(JSON.stringify({ error: 'all_tts_failed' }), {
    status: 502,
    headers: { 'Content-Type': 'application/json' },
  });
}
