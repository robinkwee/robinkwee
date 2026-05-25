'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

type Phase = 'ringing' | 'connecting' | 'active' | 'ended';
type Message = { role: 'user' | 'assistant'; content: string };

const GREETING = "Hi, this is Aria from Robin Kwee's office — I can book you a call with Robin. What's your name?";

function useCallTimer(active: boolean) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setSecs(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [active]);
  const m = String(Math.floor(secs / 60)).padStart(2, '0');
  const s = String(secs % 60).padStart(2, '0');
  return `${m}:${s}`;
}

// Pick the most natural-sounding system voice available
function pickBestVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;

  // Priority: Microsoft "Online (Natural)" > Apple premium > Google > anything en-US
  const preferences = [
    /Microsoft Aria.*Natural/i,
    /Microsoft Jenny.*Natural/i,
    /Microsoft Sonia.*Natural/i,
    /Microsoft .*Online \(Natural\)/i,
    /Samantha/i,           // Apple, very natural female
    /Karen/i,              // Apple AU, natural
    /Google US English/i,  // Chrome, decent
    /Microsoft Aria/i,
    /Microsoft Zira/i,
  ];

  for (const pattern of preferences) {
    const match = voices.find(v => pattern.test(v.name));
    if (match) return match;
  }

  return voices.find(v => v.lang === 'en-US') ?? voices[0];
}

export default function CallPage() {
  const [phase, setPhase] = useState<Phase>('ringing');
  const [messages, setMessages] = useState<Message[]>([]);
  const [transcript, setTranscript] = useState('');
  const [agentText, setAgentText] = useState('');
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [voiceLabel, setVoiceLabel] = useState<string>('');

  const audioRef = useRef<HTMLAudioElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recoRef = useRef<any>(null);
  const transcriptRef = useRef('');
  const processingRef = useRef(false);
  const callTimer = useCallTimer(phase === 'active');

  // Pre-load voices (Web Speech needs this triggered)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.speechSynthesis?.getVoices();
    const handler = () => window.speechSynthesis.getVoices();
    window.speechSynthesis?.addEventListener('voiceschanged', handler);
    return () => window.speechSynthesis?.removeEventListener('voiceschanged', handler);
  }, []);

  const stopListening = useCallback(() => {
    try { recoRef.current?.stop(); } catch { /* already stopped */ }
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

      if (!res.ok) throw new Error(`hf_${res.status}`);
      const ct = res.headers.get('content-type') ?? '';
      if (!ct.startsWith('audio/')) throw new Error('not_audio');

      const modelUsed = res.headers.get('X-TTS-Model') ?? 'hf';
      setVoiceLabel(modelUsed);

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;

      return new Promise<void>((resolve, reject) => {
        audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
        audio.onerror = () => { URL.revokeObjectURL(url); reject(new Error('playback')); };
        audio.play().catch(reject);
      });
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }, []);

  const speakWebSpeech = useCallback((text: string): Promise<void> => {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !window.speechSynthesis) { resolve(); return; }
      window.speechSynthesis.cancel();

      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1.0;
      u.pitch = 1.0;
      u.volume = 1;

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

  const speak = useCallback(async (text: string) => {
    setIsAgentSpeaking(true);
    stopListening();

    let played = false;
    try {
      await speakHF(text);
      played = true;
    } catch (err) {
      console.warn('HF TTS failed, falling back to Web Speech:', err);
    }

    if (!played) {
      try {
        await speakWebSpeech(text);
      } catch (err) {
        console.error('Web Speech also failed:', err);
      }
    }

    setIsAgentSpeaking(false);
  }, [speakHF, speakWebSpeech, stopListening]);

  const sendUserMessage = useCallback(async (text: string) => {
    if (processingRef.current) return;
    processingRef.current = true;
    setIsProcessing(true);
    setTranscript('');
    transcriptRef.current = '';
    setAgentText(''); // clear previous agent reply so it doesn't overlap

    const userMsg: Message = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);

    try {
      const res = await fetch('/api/call-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      });
      if (!res.ok || !res.body) throw new Error('failed');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value, { stream: true }).split('\n')) {
          if (line.startsWith('0:"')) { try { full += JSON.parse(line.slice(2)); } catch { /* skip */ } }
        }
      }

      setAgentText(full);
      setMessages(prev => [...prev, { role: 'assistant', content: full }]);
      setIsProcessing(false);
      await speak(full);
    } catch {
      setIsProcessing(false);
      await speak("Sorry, I missed that — could you say it again?");
    } finally {
      processingRef.current = false;
    }
  }, [messages, speak]);

  const startListening = useCallback(() => {
    if (isMuted || isAgentSpeaking || processingRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) return;

    // Clear any prior agent text once the user starts a new turn
    setAgentText('');
    setTranscript('');
    transcriptRef.current = '';

    const reco = new SR();
    reco.continuous = false;
    reco.interimResults = true;
    reco.lang = 'en-US';
    recoRef.current = reco;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    reco.onresult = (e: any) => {
      const interim = Array.from(e.results).map((r: any) => r[0].transcript).join('');
      transcriptRef.current = interim;
      setTranscript(interim);
    };
    reco.onend = () => {
      setIsListening(false);
      const final = transcriptRef.current.trim();
      if (final && !processingRef.current) {
        sendUserMessage(final);
      }
    };
    reco.onerror = () => setIsListening(false);

    try {
      reco.start();
      setIsListening(true);
    } catch (err) {
      console.error('reco.start error:', err);
      setIsListening(false);
    }
  }, [isMuted, isAgentSpeaking, sendUserMessage]);

  // Auto-resume listening once agent stops speaking (continuous conversation mode)
  useEffect(() => {
    if (phase !== 'active') return;
    if (!isAgentSpeaking && !isListening && !isProcessing && !isMuted) {
      const t = setTimeout(() => startListening(), 400);
      return () => clearTimeout(t);
    }
  }, [phase, isAgentSpeaking, isListening, isProcessing, isMuted, startListening]);

  const acceptCall = useCallback(async () => {
    setPhase('connecting');
    await new Promise(r => setTimeout(r, 600));
    setPhase('active');
    setAgentText(GREETING);
    setMessages([{ role: 'assistant', content: GREETING }]);
    await speak(GREETING);
  }, [speak]);

  const hangUp = useCallback(() => {
    stopListening();
    audioRef.current?.pause();
    window.speechSynthesis?.cancel();
    setPhase('ended');
    setIsListening(false);
    setIsAgentSpeaking(false);
    setIsProcessing(false);
  }, [stopListening]);

  useEffect(() => () => {
    try { recoRef.current?.stop(); } catch { /* noop */ }
    audioRef.current?.pause();
    window.speechSynthesis?.cancel();
  }, []);

  const [ringFrame, setRingFrame] = useState(0);
  useEffect(() => {
    if (phase !== 'ringing') return;
    const t = setInterval(() => setRingFrame(f => f + 1), 600);
    return () => clearInterval(t);
  }, [phase]);

  return (
    <div className="min-h-dvh bg-[#0d0d0d] flex flex-col items-center justify-between px-6 py-12 select-none">

      {/* Caller info */}
      <div className="flex flex-col items-center gap-2 mt-4">
        <p className="text-gray-600 text-xs tracking-widest uppercase">
          {phase === 'ringing' ? 'Incoming Call' :
           phase === 'connecting' ? 'Connecting...' :
           phase === 'active' ? callTimer :
           'Call Ended'}
        </p>
        <h1 className="text-2xl font-light text-white tracking-tight">Robin Kwee · Office</h1>
        <p className="text-gray-600 text-sm">+63 917 848 2217</p>
        {phase === 'active' && voiceLabel && (
          <span className="text-[10px] text-gray-600 mt-1 lowercase">voice · {voiceLabel}</span>
        )}
      </div>

      {/* Avatar */}
      <div className="relative flex items-center justify-center my-8">
        {phase === 'ringing' && (
          <>
            <span className="absolute w-44 h-44 rounded-full border border-white/5 animate-ping" style={{ animationDuration: '1.5s' }} />
            <span className="absolute w-36 h-36 rounded-full border border-white/10 animate-ping" style={{ animationDuration: '1.1s' }} />
          </>
        )}
        {isAgentSpeaking && (
          <>
            <span className="absolute w-44 h-44 rounded-full border border-emerald-900/30 animate-ping" style={{ animationDuration: '1.2s' }} />
            <span className="absolute w-36 h-36 rounded-full border border-emerald-800/40 animate-ping" style={{ animationDuration: '0.85s' }} />
          </>
        )}
        <div className="w-28 h-28 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 border border-gray-700 flex items-center justify-center relative overflow-hidden">
          <span className="text-4xl">👩🏻‍💼</span>
          {isAgentSpeaking && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500/60 animate-pulse" />
          )}
        </div>
      </div>

      {/* Single-status text area — priority: speaking > thinking > listening > idle */}
      <div className="w-full max-w-xs text-center min-h-[80px] flex flex-col items-center justify-center px-2">
        {phase === 'ringing' && (
          <p className="text-gray-500 text-sm animate-pulse">
            {['ringing.  ', 'ringing.. ', 'ringing...'][ringFrame % 3]}
          </p>
        )}

        {phase === 'active' && isAgentSpeaking && agentText && (
          <p className="text-gray-200 text-sm leading-relaxed">&ldquo;{agentText}&rdquo;</p>
        )}

        {phase === 'active' && !isAgentSpeaking && isProcessing && (
          <div className="flex gap-1.5 items-center">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        )}

        {phase === 'active' && !isAgentSpeaking && !isProcessing && isListening && (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <p className="text-gray-400 text-sm italic">
              {transcript || 'Listening...'}
            </p>
          </div>
        )}

        {phase === 'active' && !isAgentSpeaking && !isProcessing && !isListening && (
          <p className="text-gray-600 text-xs">
            {isMuted ? 'Muted' : 'Connecting mic...'}
          </p>
        )}

        {phase === 'ended' && (
          <div className="space-y-1">
            <p className="text-gray-500 text-sm">Call ended · {callTimer}</p>
            <a href="/" className="text-gray-700 text-xs hover:text-gray-500 transition-colors">← Back</a>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="w-full max-w-xs">
        {phase === 'ringing' && (
          <div className="flex justify-center gap-16">
            <button onClick={() => setPhase('ended')}
              className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-500 transition-colors flex items-center justify-center shadow-lg">
              <PhoneDownIcon />
            </button>
            <button onClick={acceptCall}
              className="w-16 h-16 rounded-full bg-emerald-600 hover:bg-emerald-500 transition-colors flex items-center justify-center shadow-lg animate-bounce">
              <PhoneIcon />
            </button>
          </div>
        )}

        {phase === 'active' && (
          <div className="flex justify-center items-end gap-8">
            <button
              onClick={() => {
                const next = !isMuted;
                setIsMuted(next);
                if (next) stopListening();
              }}
              className={`w-14 h-14 rounded-full flex flex-col items-center justify-center gap-1 transition-colors ${isMuted ? 'bg-red-900/60 text-red-400' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
            >
              <MicIcon muted={isMuted} />
              <span className="text-[9px]">{isMuted ? 'Unmute' : 'Mute'}</span>
            </button>

            <button onClick={hangUp}
              className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-500 transition-colors flex items-center justify-center shadow-lg">
              <PhoneDownIcon />
            </button>

            <button
              onClick={startListening}
              disabled={isMuted || isAgentSpeaking || isProcessing || isListening}
              className={`w-14 h-14 rounded-full flex flex-col items-center justify-center gap-1 transition-colors ${isListening ? 'bg-emerald-800 text-emerald-300' : 'bg-gray-800 text-gray-400 hover:text-white'} disabled:opacity-30`}
            >
              <span className="text-lg">🎙</span>
              <span className="text-[9px]">Speak</span>
            </button>
          </div>
        )}

        {phase === 'connecting' && (
          <div className="flex justify-center">
            <div className="w-8 h-8 border-2 border-gray-700 border-t-emerald-500 rounded-full animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}

function PhoneIcon() {
  return (
    <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
      <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" />
    </svg>
  );
}

function PhoneDownIcon() {
  return (
    <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08A.99.99 0 0 1 0 12.37c0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.66c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.1-.7-.28a11.27 11.27 0 0 0-2.67-1.85.999.999 0 0 1-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" />
    </svg>
  );
}

function MicIcon({ muted }: { muted: boolean }) {
  return muted ? (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z" />
    </svg>
  ) : (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
    </svg>
  );
}
