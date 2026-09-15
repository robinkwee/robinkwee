'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import BookingForm, { type BookingSuccess } from './BookingForm';

type Phase = 'ringing' | 'connecting' | 'active' | 'ended';
type Message = { role: 'user' | 'assistant'; content: string };

const GREETING =
  "Hi, this is Aria from Robin Kwee's office — I can book you a call with Robin. What's your name?";

const CONTACT_EMAIL = 'robinkwee@gmail.com';

// ── speech synthesis ───────────────────────────────────────────────────────

/** Pick the most natural-sounding system voice available. */
function pickBestVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;

  const preferences = [
    /Microsoft Aria.*Natural/i,
    /Microsoft Jenny.*Natural/i,
    /Microsoft Sonia.*Natural/i,
    /Microsoft .*Online \(Natural\)/i,
    /Samantha/i,
    /Karen/i,
    /Google US English/i,
    /Microsoft Aria/i,
    /Microsoft Zira/i,
  ];

  for (const pattern of preferences) {
    const match = voices.find((v) => pattern.test(v.name));
    if (match) return match;
  }

  return voices.find((v) => v.lang === 'en-US') ?? voices[0];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SpeechRecognitionLike = any;

function getSpeechRecognition(): SpeechRecognitionLike | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as Record<string, SpeechRecognitionLike>;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const neverChanges = () => () => {};
/**
 * Whether this browser can listen at all. Firefox and every non-Safari engine
 * on iOS cannot, and the old page simply did nothing there — the caller sat on
 * "Connecting mic…" forever with no way to answer. The server snapshot assumes
 * support because the mic controls are not rendered until the call is answered.
 */
const hasSpeechRecognition = () => getSpeechRecognition() !== null;

// ── agent stream ───────────────────────────────────────────────────────────

interface AgentTurn {
  text: string;
  booking: BookingSuccess | null;
  error: string | null;
}

/**
 * Parse the AI SDK data-stream protocol.
 *
 * The previous reader split each network chunk on newlines in isolation, so a
 * line straddling two chunks — routine for a streamed response — was dropped
 * or half-parsed, which showed up as the agent losing words mid-sentence. The
 * buffer below carries the partial line across reads. It also reads the error
 * (`3:`) and tool-result (`a:`) parts, which were ignored entirely: a failed
 * booking looked identical to a successful one.
 */
async function readAgentStream(body: ReadableStream<Uint8Array>): Promise<AgentTurn> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const turn: AgentTurn = { text: '', booking: null, error: null };
  let buffer = '';

  const handleLine = (line: string) => {
    const separator = line.indexOf(':');
    if (separator < 1) return;

    const code = line.slice(0, separator);
    let payload: unknown;
    try {
      payload = JSON.parse(line.slice(separator + 1));
    } catch {
      return;
    }

    if (code === '0' && typeof payload === 'string') {
      turn.text += payload;
      return;
    }

    if (code === '3') {
      turn.error = typeof payload === 'string' ? payload : 'Something went wrong.';
      return;
    }

    if (code === 'a') {
      const result = (payload as { result?: Record<string, unknown> })?.result;
      if (result?.success === true) {
        turn.booking = {
          bookingRef: String(result.bookingRef ?? ''),
          whenManila: String(result.whenManila ?? ''),
          meetLink: null,
          durationMinutes: 30,
        };
      } else if (result && result.success === false && typeof result.error === 'string') {
        turn.error = result.error;
      }
    }
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let newline = buffer.indexOf('\n');
      while (newline !== -1) {
        handleLine(buffer.slice(0, newline));
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf('\n');
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) handleLine(buffer);
  } finally {
    reader.releaseLock();
  }

  return turn;
}

// ── component ──────────────────────────────────────────────────────────────

function useCallTimer(active: boolean) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [active]);
  const m = String(Math.floor(secs / 60)).padStart(2, '0');
  const s = String(secs % 60).padStart(2, '0');
  return `${m}:${s}`;
}

export default function CallExperience() {
  const [phase, setPhase] = useState<Phase>('ringing');
  const [messages, setMessages] = useState<Message[]>([]);
  const [transcript, setTranscript] = useState('');
  const [agentText, setAgentText] = useState('');
  const [typed, setTyped] = useState('');
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [voiceLabel, setVoiceLabel] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [booking, setBooking] = useState<BookingSuccess | null>(null);
  const [speechUnavailable, setSpeechUnavailable] = useState(false);

  const speechDetected = useSyncExternalStore(neverChanges, hasSpeechRecognition, () => true);
  const speechSupported = speechDetected && !speechUnavailable;
  /** Once the caller types, stop grabbing the mic on every turn. */
  const [voiceInputPaused, setVoiceInputPaused] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recoRef = useRef<SpeechRecognitionLike>(null);
  const transcriptRef = useRef('');
  const processingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const endedRef = useRef(false);
  const callTimer = useCallTimer(phase === 'active');

  useEffect(() => {
    // Voices load asynchronously; touching the list primes it.
    window.speechSynthesis?.getVoices();
    const handler = () => window.speechSynthesis.getVoices();
    window.speechSynthesis?.addEventListener('voiceschanged', handler);
    return () => window.speechSynthesis?.removeEventListener('voiceschanged', handler);
  }, []);

  const stopListening = useCallback(() => {
    try {
      recoRef.current?.stop();
    } catch {
      /* already stopped */
    }
    setIsListening(false);
  }, []);

  const speakHF = useCallback(async (text: string): Promise<void> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    try {
      const res = await fetch('/api/kokoro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) throw new Error(`tts_${res.status}`);
      const ct = res.headers.get('content-type') ?? '';
      if (!ct.startsWith('audio/')) throw new Error('not_audio');

      setVoiceLabel(res.headers.get('X-TTS-Model') ?? 'hf');

      const url = URL.createObjectURL(await res.blob());
      const audio = new Audio(url);
      audioRef.current = audio;

      return await new Promise<void>((resolve, reject) => {
        audio.onended = () => {
          URL.revokeObjectURL(url);
          resolve();
        };
        audio.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error('playback'));
        };
        audio.play().catch(reject);
      });
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }, []);

  const speakWebSpeech = useCallback((text: string): Promise<void> => {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !window.speechSynthesis) {
        resolve();
        return;
      }
      window.speechSynthesis.cancel();

      const u = new SpeechSynthesisUtterance(text);
      const voice = pickBestVoice();
      if (voice) {
        u.voice = voice;
        u.lang = voice.lang;
        setVoiceLabel(voice.name.replace(/Microsoft|Online|\(Natural\)/g, '').trim() || 'browser');
      } else {
        setVoiceLabel('browser');
      }

      u.onend = () => resolve();
      u.onerror = () => resolve();
      window.speechSynthesis.speak(u);
    });
  }, []);

  const speak = useCallback(
    async (text: string) => {
      if (endedRef.current || !text.trim()) return;
      setIsAgentSpeaking(true);
      stopListening();

      try {
        await speakHF(text);
      } catch (err) {
        console.warn('Hosted TTS failed, falling back to Web Speech:', err);
        try {
          await speakWebSpeech(text);
        } catch (fallbackErr) {
          // The reply is on screen either way, so a silent turn is survivable.
          console.error('Web Speech also failed:', fallbackErr);
        }
      }

      setIsAgentSpeaking(false);
    },
    [speakHF, speakWebSpeech, stopListening]
  );

  const sendUserMessage = useCallback(
    async (text: string) => {
      const clean = text.trim();
      if (!clean || processingRef.current || endedRef.current) return;

      processingRef.current = true;
      setIsProcessing(true);
      setNotice(null);
      setTranscript('');
      transcriptRef.current = '';
      setAgentText('');

      const history = [...messages, { role: 'user' as const, content: clean }];
      setMessages(history);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch('/api/call-agent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: history }),
          signal: controller.signal,
        });

        if (res.status === 429) {
          const { error } = await res.json().catch(() => ({ error: null }));
          setNotice(
            error ?? `Too many messages for now — use the form below or email ${CONTACT_EMAIL}.`
          );
          return;
        }
        if (!res.ok || !res.body) throw new Error(`agent_${res.status}`);

        const turn = await readAgentStream(res.body);
        if (endedRef.current) return;

        if (turn.booking) setBooking(turn.booking);
        if (turn.error && !turn.text) {
          setNotice(turn.error);
          setIsProcessing(false);
          await speak(turn.error);
          return;
        }

        const reply = turn.text.trim();
        if (!reply) {
          setNotice(`I did not catch that. Try again, or use the booking form below.`);
          return;
        }

        setAgentText(reply);
        setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
        setIsProcessing(false);
        await speak(reply);
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error('agent turn failed', err);
        const fallback = "Sorry, I lost that — could you say it again?";
        setAgentText(fallback);
        setNotice(`If this keeps happening, use the booking form below or email ${CONTACT_EMAIL}.`);
        setIsProcessing(false);
        await speak(fallback);
      } finally {
        processingRef.current = false;
        setIsProcessing(false);
        abortRef.current = null;
      }
    },
    [messages, speak]
  );

  const startListening = useCallback(() => {
    if (isMuted || isAgentSpeaking || processingRef.current || endedRef.current) return;

    const SR = getSpeechRecognition();
    if (!SR) {
      setSpeechUnavailable(true);
      return;
    }

    setAgentText('');
    setTranscript('');
    transcriptRef.current = '';

    const reco = new SR();
    reco.continuous = false;
    reco.interimResults = true;
    reco.lang = 'en-US';
    recoRef.current = reco;

    reco.onresult = (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => {
      const interim = Array.from(e.results)
        .map((r) => r[0].transcript)
        .join('');
      transcriptRef.current = interim;
      setTranscript(interim);
    };

    reco.onend = () => {
      setIsListening(false);
      const final = transcriptRef.current.trim();
      if (final && !processingRef.current) sendUserMessage(final);
    };

    reco.onerror = (e: { error?: string }) => {
      setIsListening(false);
      if (e?.error === 'not-allowed' || e?.error === 'service-not-allowed') {
        setVoiceInputPaused(true);
        setNotice('Microphone access is blocked. You can type your answers below instead.');
      } else if (e?.error === 'audio-capture') {
        setVoiceInputPaused(true);
        setNotice('No microphone found. You can type your answers below instead.');
      } else if (e?.error === 'network') {
        setVoiceInputPaused(true);
        setNotice('Speech recognition is unavailable right now. Typing works just as well.');
      }
    };

    try {
      reco.start();
      setIsListening(true);
    } catch (err) {
      console.error('Could not start speech recognition:', err);
      setIsListening(false);
    }
  }, [isMuted, isAgentSpeaking, sendUserMessage]);

  // Continuous conversation: resume listening once the agent stops talking.
  useEffect(() => {
    if (phase !== 'active' || !speechSupported || voiceInputPaused) return;
    if (!isAgentSpeaking && !isListening && !isProcessing && !isMuted) {
      const t = setTimeout(() => startListening(), 400);
      return () => clearTimeout(t);
    }
  }, [
    phase,
    isAgentSpeaking,
    isListening,
    isProcessing,
    isMuted,
    speechSupported,
    voiceInputPaused,
    startListening,
  ]);

  const acceptCall = useCallback(async () => {
    endedRef.current = false;
    setPhase('connecting');
    await new Promise((r) => setTimeout(r, 600));
    setPhase('active');
    setAgentText(GREETING);
    setMessages([{ role: 'assistant', content: GREETING }]);
    if (!getSpeechRecognition()) {
      setSpeechUnavailable(true);
      setVoiceInputPaused(true);
      setNotice('This browser cannot listen, so type your answers below — or use the form.');
    }
    await speak(GREETING);
  }, [speak]);

  const hangUp = useCallback(() => {
    endedRef.current = true;
    abortRef.current?.abort();
    stopListening();
    audioRef.current?.pause();
    window.speechSynthesis?.cancel();
    setPhase('ended');
    setIsListening(false);
    setIsAgentSpeaking(false);
    setIsProcessing(false);
  }, [stopListening]);

  useEffect(
    () => () => {
      endedRef.current = true;
      abortRef.current?.abort();
      try {
        recoRef.current?.stop();
      } catch {
        /* noop */
      }
      audioRef.current?.pause();
      window.speechSynthesis?.cancel();
    },
    []
  );

  const [ringFrame, setRingFrame] = useState(0);
  useEffect(() => {
    if (phase !== 'ringing') return;
    const t = setInterval(() => setRingFrame((f) => f + 1), 600);
    return () => clearInterval(t);
  }, [phase]);

  const submitTyped = (event: React.FormEvent) => {
    event.preventDefault();
    const text = typed.trim();
    if (!text) return;
    setTyped('');
    setVoiceInputPaused(true);
    stopListening();
    sendUserMessage(text);
  };

  return (
    <div className="min-h-dvh bg-[#0d0d0d] text-white">
      <div className="mx-auto flex min-h-dvh max-w-md flex-col px-6 py-10">
        {/* Caller info */}
        <div className="flex flex-col items-center gap-2">
          <p className="text-xs uppercase tracking-widest text-gray-600">
            {phase === 'ringing'
              ? 'Incoming Call'
              : phase === 'connecting'
                ? 'Connecting…'
                : phase === 'active'
                  ? callTimer
                  : 'Call Ended'}
          </p>
          <h1 className="text-2xl font-light tracking-tight text-white">Robin Kwee · Office</h1>
          <p className="text-sm text-gray-600">Aria — booking assistant</p>
          {phase === 'active' && voiceLabel && (
            <span className="mt-1 text-[10px] lowercase text-gray-600">voice · {voiceLabel}</span>
          )}
        </div>

        {/* Avatar */}
        <div className="relative my-8 flex items-center justify-center">
          {phase === 'ringing' && (
            <>
              <span
                className="absolute h-44 w-44 animate-ping rounded-full border border-white/5"
                style={{ animationDuration: '1.5s' }}
              />
              <span
                className="absolute h-36 w-36 animate-ping rounded-full border border-white/10"
                style={{ animationDuration: '1.1s' }}
              />
            </>
          )}
          {isAgentSpeaking && (
            <>
              <span
                className="absolute h-44 w-44 animate-ping rounded-full border border-emerald-900/30"
                style={{ animationDuration: '1.2s' }}
              />
              <span
                className="absolute h-36 w-36 animate-ping rounded-full border border-emerald-800/40"
                style={{ animationDuration: '0.85s' }}
              />
            </>
          )}
          <div className="relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border border-gray-700 bg-gradient-to-br from-gray-700 to-gray-900">
            <span className="text-4xl" aria-hidden="true">
              👩🏻‍💼
            </span>
            {isAgentSpeaking && (
              <div className="absolute bottom-0 left-0 right-0 h-1 animate-pulse bg-emerald-500/60" />
            )}
          </div>
        </div>

        {/* Status line */}
        <div
          className="flex min-h-[80px] w-full flex-col items-center justify-center px-2 text-center"
          aria-live="polite"
        >
          {phase === 'ringing' && (
            <p className="animate-pulse text-sm text-gray-500">
              {['ringing.  ', 'ringing.. ', 'ringing...'][ringFrame % 3]}
            </p>
          )}

          {phase === 'active' && agentText && (
            <p className="text-sm leading-relaxed text-gray-200">&ldquo;{agentText}&rdquo;</p>
          )}

          {phase === 'active' && !agentText && isProcessing && (
            <div className="flex items-center gap-1.5">
              {[0, 150, 300].map((delay) => (
                <span
                  key={delay}
                  className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-500"
                  style={{ animationDelay: `${delay}ms` }}
                />
              ))}
            </div>
          )}

          {phase === 'active' && !agentText && !isProcessing && isListening && (
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
              <p className="text-sm italic text-gray-400">{transcript || 'Listening…'}</p>
            </div>
          )}

          {phase === 'ended' && <p className="text-sm text-gray-500">Call ended · {callTimer}</p>}
        </div>

        {notice && (
          <p
            className="mb-4 rounded-lg border border-amber-900/50 bg-amber-950/20 px-3 py-2 text-center text-xs text-amber-200"
            role="status"
          >
            {notice}
          </p>
        )}

        {booking && (
          <div
            className="mb-4 rounded-lg border border-emerald-800/60 bg-emerald-950/30 px-3 py-2 text-center text-xs text-emerald-200"
            role="status"
          >
            Booked — {booking.whenManila}. Invite on its way
            {booking.bookingRef ? ` (ref ${booking.bookingRef})` : ''}.
          </div>
        )}

        {/* Controls */}
        <div className="w-full">
          {phase === 'ringing' && (
            <div className="flex justify-center gap-16">
              <button
                onClick={() => setPhase('ended')}
                aria-label="Decline call"
                className="flex h-16 w-16 items-center justify-center rounded-full bg-red-600 shadow-lg transition-colors hover:bg-red-500"
              >
                <PhoneDownIcon />
              </button>
              <button
                onClick={acceptCall}
                aria-label="Answer call"
                className="flex h-16 w-16 animate-bounce items-center justify-center rounded-full bg-emerald-600 shadow-lg transition-colors hover:bg-emerald-500"
              >
                <PhoneIcon />
              </button>
            </div>
          )}

          {phase === 'connecting' && (
            <div className="flex justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-700 border-t-emerald-500" />
            </div>
          )}

          {phase === 'active' && (
            <>
              <div className="flex items-end justify-center gap-8">
                <button
                  onClick={() => {
                    const next = !isMuted;
                    setIsMuted(next);
                    if (next) stopListening();
                  }}
                  disabled={!speechSupported}
                  aria-pressed={isMuted}
                  className={`flex h-14 w-14 flex-col items-center justify-center gap-1 rounded-full transition-colors disabled:opacity-30 ${
                    isMuted ? 'bg-red-900/60 text-red-400' : 'bg-gray-800 text-gray-400 hover:text-white'
                  }`}
                >
                  <MicIcon muted={isMuted} />
                  <span className="text-[9px]">{isMuted ? 'Unmute' : 'Mute'}</span>
                </button>

                <button
                  onClick={hangUp}
                  aria-label="End call"
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-red-600 shadow-lg transition-colors hover:bg-red-500"
                >
                  <PhoneDownIcon />
                </button>

                <button
                  onClick={() => {
                    setVoiceInputPaused(false);
                    startListening();
                  }}
                  disabled={!speechSupported || isMuted || isAgentSpeaking || isProcessing || isListening}
                  className={`flex h-14 w-14 flex-col items-center justify-center gap-1 rounded-full transition-colors disabled:opacity-30 ${
                    isListening ? 'bg-emerald-800 text-emerald-300' : 'bg-gray-800 text-gray-400 hover:text-white'
                  }`}
                >
                  <span className="text-lg" aria-hidden="true">
                    🎙
                  </span>
                  <span className="text-[9px]">Speak</span>
                </button>
              </div>

              {/* Typed fallback — always available, not just when speech fails. */}
              <form onSubmit={submitTyped} className="mt-6 flex gap-2">
                <label htmlFor="call-typed" className="sr-only">
                  Type your reply to Aria
                </label>
                <input
                  id="call-typed"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  placeholder="…or type your answer"
                  maxLength={2000}
                  className="flex-1 rounded-lg border border-gray-800 bg-[#111] px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-emerald-700 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!typed.trim() || isProcessing}
                  className="rounded-lg bg-gray-800 px-4 text-sm text-gray-300 transition-colors hover:bg-gray-700 disabled:opacity-40"
                >
                  Send
                </button>
              </form>
            </>
          )}

          {phase === 'ended' && (
            <div className="flex justify-center">
              <button
                onClick={acceptCall}
                className="rounded-lg border border-gray-800 px-4 py-2 text-xs text-gray-400 transition-colors hover:border-gray-700 hover:text-white"
              >
                Call again
              </button>
            </div>
          )}
        </div>

        {/* Transcript */}
        {messages.length > 1 && (
          <details className="mt-6 text-xs text-gray-500">
            <summary className="cursor-pointer hover:text-gray-300">Transcript</summary>
            <ul className="mt-2 space-y-1.5">
              {messages.map((m, i) => (
                <li key={i}>
                  <span className={m.role === 'user' ? 'text-gray-400' : 'text-emerald-400/80'}>
                    {m.role === 'user' ? 'You' : 'Aria'}:
                  </span>{' '}
                  <span className="text-gray-400">{m.content}</span>
                </li>
              ))}
            </ul>
          </details>
        )}

        {/* Always-available booking form */}
        <section className="mt-10 border-t border-gray-900 pt-8" aria-labelledby="book-heading">
          <h2 id="book-heading" className="mb-1 text-sm font-medium text-white">
            Or book it yourself
          </h2>
          <p className="mb-5 text-xs text-gray-500">
            No microphone needed. Same calendar, same invite.
          </p>
          <BookingForm onBooked={setBooking} />
        </section>

        <div className="mt-10 border-t border-gray-900 pt-6 text-center">
          <Link href="/" className="text-xs text-gray-700 transition-colors hover:text-gray-500">
            ← Back to robinkwee.com
          </Link>
        </div>
      </div>
    </div>
  );
}

function PhoneIcon() {
  return (
    <svg className="h-7 w-7 text-white" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" />
    </svg>
  );
}

function PhoneDownIcon() {
  return (
    <svg className="h-7 w-7 text-white" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08A.99.99 0 0 1 0 12.37c0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.66c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.1-.7-.28a11.27 11.27 0 0 0-2.67-1.85.999.999 0 0 1-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" />
    </svg>
  );
}

function MicIcon({ muted }: { muted: boolean }) {
  return muted ? (
    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z" />
    </svg>
  ) : (
    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
    </svg>
  );
}
