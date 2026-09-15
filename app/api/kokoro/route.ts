import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { clientIp, json, tooManyRequests } from '@/lib/http';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const maxDuration = 30;

// Microsoft Edge TTS (Azure Neural Voices) — free, no API key, ~300ms latency.
// Aria is Microsoft's call-center-tuned voice.
// HF cascade kept as fallback if the Edge endpoint is ever unreachable.

const EDGE_VOICE = 'en-US-AriaNeural';
const EDGE_TIMEOUT_MS = 12_000;

/**
 * Synthesis time scales with input length, so an unbounded body was a way to
 * tie up a serverless function for free. Agent replies are two sentences.
 */
const MAX_TEXT_CHARS = 1_000;
const SYNTH_LIMIT = 120;
const SYNTH_WINDOW_MS = 60 * 60_000;

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
      const timeout = setTimeout(() => resolve(null), EDGE_TIMEOUT_MS);
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
    console.warn('[tts] edge failed:', err);
    return null;
  }
}

async function tryHF(
  text: string,
  hfToken: string
): Promise<{ audio: ArrayBuffer; contentType: string; name: string } | null> {
  for (const model of HF_MODELS) {
    try {
      const res = await fetch(`https://api-inference.huggingface.co/models/${model.id}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${hfToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputs: text }),
      });
      const ct = res.headers.get('content-type') ?? '';
      if (!res.ok || ct.includes('application/json')) {
        console.warn(`[tts] ${model.name} skipped (${res.status} ${ct})`);
        continue;
      }
      return { audio: await res.arrayBuffer(), contentType: ct || 'audio/wav', name: model.name };
    } catch (err) {
      console.warn(`[tts] ${model.name} threw:`, err);
    }
  }
  return null;
}

export async function POST(req: Request) {
  const limit = await rateLimit(`tts:${clientIp(req)}`, SYNTH_LIMIT, SYNTH_WINDOW_MS);
  if (!limit.ok) {
    // The caller falls back to the browser's own speech synthesis.
    return tooManyRequests(limit.retryAfterSeconds, 'Speech limit reached.');
  }

  let text: string;
  try {
    const body = (await req.json()) as { text?: unknown };
    if (typeof body.text !== 'string' || !body.text.trim()) throw new Error('empty');
    text = body.text.trim().slice(0, MAX_TEXT_CHARS);
  } catch {
    return json({ error: 'invalid body' }, { status: 400 });
  }

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

  // Nothing worked — the client falls back to Web Speech.
  return json({ error: 'all_tts_failed' }, { status: 502 });
}
