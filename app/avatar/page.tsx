'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

type Message = { role: 'user' | 'assistant'; content: string };

const STARTER_QUESTIONS = [
  "What's your one rule for investing?",
  "How do you spot a good business?",
  "What do most investors get wrong?",
  "What should I read?",
];

export default function AvatarPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [displayedText, setDisplayedText] = useState('');
  const [hasElevenLabs, setHasElevenLabs] = useState<boolean | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Probe ElevenLabs availability once on mount
  useEffect(() => {
    fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: '' }) })
      .then(r => setHasElevenLabs(r.status !== 503))
      .catch(() => setHasElevenLabs(false));
  }, []);

  const stopSpeaking = useCallback(() => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ''; }
    window.speechSynthesis?.cancel();
    if (typingRef.current) clearInterval(typingRef.current);
    setIsSpeaking(false);
  }, []);

  const runTypewriter = useCallback((text: string, onDone?: () => void) => {
    setDisplayedText('');
    let i = 0;
    typingRef.current = setInterval(() => {
      i++;
      setDisplayedText(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(typingRef.current!);
        onDone?.();
      }
    }, 22);
  }, []);

  const speakElevenLabs = useCallback(async (text: string) => {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error('tts_failed');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.onended = () => { setIsSpeaking(false); URL.revokeObjectURL(url); };
    audio.onerror = () => { setIsSpeaking(false); URL.revokeObjectURL(url); };
    runTypewriter(text);
    setIsSpeaking(true);
    await audio.play();
  }, [runTypewriter]);

  const speakWebSpeech = useCallback((text: string) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    // Deep, slow — closest to an elderly deliberate voice
    utterance.rate = 0.78;
    utterance.pitch = 0.72;
    utterance.volume = 1;

    const setVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      const pick = voices.find(v =>
        v.name.includes('Daniel') || v.name.includes('Google US English') ||
        v.name.includes('Alex') || (v.lang === 'en-US' && v.localService)
      );
      if (pick) utterance.voice = pick;
    };
    window.speechSynthesis.getVoices().length ? setVoice() :
      window.speechSynthesis.addEventListener('voiceschanged', setVoice, { once: true });

    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    runTypewriter(text, () => {});
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }, [runTypewriter]);

  const speakText = useCallback((text: string) => {
    stopSpeaking();
    if (hasElevenLabs) {
      speakElevenLabs(text).catch(() => speakWebSpeech(text));
    } else {
      speakWebSpeech(text);
    }
  }, [hasElevenLabs, speakElevenLabs, speakWebSpeech, stopSpeaking]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;
    const userMsg: Message = { role: 'user', content: text.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);
    stopSpeaking();

    try {
      const res = await fetch('/api/avatar-chat', {
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
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          if (line.startsWith('0:"')) {
            try { full += JSON.parse(line.slice(2)); } catch { /* skip */ }
          }
        }
      }

      const assistantMsg: Message = { role: 'assistant', content: full };
      setMessages(prev => [...prev, assistantMsg]);
      speakText(full);
    } catch {
      const err: Message = { role: 'assistant', content: "I have nothing to add." };
      setMessages(prev => [...prev, err]);
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading, speakText, stopSpeaking]);

  useEffect(() => () => stopSpeaking(), [stopSpeaking]);

  const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');

  return (
    <div className="min-h-dvh bg-[#0a0a0a] text-white flex flex-col items-center justify-start px-4 py-10">
      <div className="w-full max-w-sm flex flex-col items-center gap-6">

        {/* Header */}
        <div className="text-center">
          <p className="text-amber-700/60 text-xs tracking-widest uppercase mb-1">AI Avatar</p>
          <h1 className="text-xl font-semibold tracking-tight text-amber-50">Charlie Munger</h1>
          <p className="text-amber-900/60 text-xs mt-0.5">1924 – 2023 · Berkshire Hathaway</p>
        </div>

        {/* Talking Avatar */}
        <div className="relative flex items-center justify-center">
          {isSpeaking && (
            <>
              <span className="absolute w-36 h-36 rounded-full border border-amber-700/20 animate-ping" style={{ animationDuration: '1.4s' }} />
              <span className="absolute w-28 h-28 rounded-full border border-amber-600/30 animate-ping" style={{ animationDuration: '1s' }} />
            </>
          )}

          {isSpeaking && (
            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 flex items-end gap-[3px]">
              {[5, 9, 14, 10, 15, 11, 7, 13, 9, 6].map((h, i) => (
                <div key={i} className="w-1 rounded-full bg-amber-600/70"
                  style={{ height: `${h}px`, animation: `audioBar 0.55s ease-in-out ${i * 0.07}s infinite alternate` }} />
              ))}
            </div>
          )}

          {/* CM avatar — sepia tone placeholder; replace src with a real photo */}
          <div
            className="relative w-24 h-24 rounded-full overflow-hidden flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #3d2b1f 0%, #6b4226 100%)',
              boxShadow: isSpeaking
                ? '0 0 0 3px #92400e, 0 0 28px rgba(180,120,40,0.25)'
                : '0 0 0 2px #3d2b1f',
              transition: 'box-shadow 0.3s ease',
            }}
          >
            {/* Swap this <span> for <img src="/charlie.jpg" className="w-full h-full object-cover" /> */}
            <span className="text-3xl font-bold text-amber-300/80 select-none">CM</span>
          </div>
        </div>

        {/* Voice badge */}
        {hasElevenLabs !== null && (
          <div className={`text-xs px-2 py-0.5 rounded-full border ${hasElevenLabs ? 'border-amber-700/40 text-amber-700' : 'border-gray-800 text-gray-600'}`}>
            {hasElevenLabs ? 'ElevenLabs voice' : 'Browser voice (add ELEVENLABS_API_KEY for cloned voice)'}
          </div>
        )}

        {/* Speech bubble */}
        <div className="w-full min-h-[72px] rounded-xl bg-[#111] border border-amber-900/30 px-4 py-3 text-sm text-amber-100/90 leading-relaxed">
          {isLoading && !displayedText ? (
            <div className="flex items-center gap-1 text-amber-900/60">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-800 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-amber-800 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-amber-800 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          ) : displayedText ? (
            <p className="italic">&ldquo;{displayedText}{isSpeaking && <span className="animate-pulse ml-0.5 text-amber-400">|</span>}&rdquo;</p>
          ) : lastAssistant ? (
            <p className="italic">&ldquo;{lastAssistant.content}&rdquo;</p>
          ) : (
            <p className="text-amber-900/40 italic">Ask anything...</p>
          )}
        </div>

        {/* Replay */}
        {lastAssistant && !isLoading && (
          <div className="flex gap-2 w-full">
            <button
              onClick={() => isSpeaking ? stopSpeaking() : speakText(lastAssistant.content)}
              className="flex-1 py-2 text-xs rounded-lg border border-amber-900/40 text-amber-800 hover:text-amber-500 hover:border-amber-700 transition-colors"
            >
              {isSpeaking ? '⏹ Stop' : '▶ Replay'}
            </button>
          </div>
        )}

        {/* Starters */}
        {messages.length === 0 && (
          <div className="w-full grid grid-cols-2 gap-2">
            {STARTER_QUESTIONS.map(q => (
              <button key={q} onClick={() => sendMessage(q)}
                className="text-left text-xs px-3 py-2.5 rounded-lg border border-amber-900/30 text-amber-900/70 hover:border-amber-700/50 hover:text-amber-500 transition-colors leading-snug">
                {q}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <form className="w-full flex gap-2" onSubmit={e => { e.preventDefault(); sendMessage(input); }}>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask Charlie something..."
            className="flex-1 bg-[#111] border border-amber-900/30 rounded-lg px-3 py-2 text-sm text-amber-100 placeholder-amber-900/40 outline-none focus:border-amber-800 transition-colors"
            disabled={isLoading}
          />
          <button type="submit" disabled={isLoading || !input.trim()}
            className="px-4 py-2 rounded-lg bg-amber-900 text-amber-100 text-sm font-medium disabled:opacity-30 hover:bg-amber-800 transition-colors">
            Ask
          </button>
        </form>

        {/* History */}
        {messages.length > 0 && (
          <div className="w-full space-y-1.5 pt-2 border-t border-amber-900/20">
            {messages.slice(-6).map((m, i) => m.role === 'user' && (
              <div key={i} className="text-right">
                <span className="text-xs text-amber-900/50 bg-[#111] px-2 py-1 rounded-lg inline-block">{m.content}</span>
              </div>
            ))}
          </div>
        )}

        <a href="/" className="text-amber-900/40 text-xs hover:text-amber-700 transition-colors mt-2">← Back</a>
      </div>

      <style>{`
        @keyframes audioBar { from { transform: scaleY(0.35); } to { transform: scaleY(1.7); } }
      `}</style>
    </div>
  );
}
