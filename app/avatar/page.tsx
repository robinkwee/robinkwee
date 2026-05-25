'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

type Message = { role: 'user' | 'assistant'; content: string };

const STARTER_QUESTIONS = [
  "What are you building right now?",
  "What's your take on AI?",
  "How do I work with you?",
  "Tell me about padel in the Philippines",
];

export default function AvatarPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentText, setCurrentText] = useState('');
  const [displayedText, setDisplayedText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const typingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis.cancel();
    if (typingRef.current) clearInterval(typingRef.current);
    setIsSpeaking(false);
  }, []);

  const speakText = useCallback((text: string) => {
    stopSpeaking();
    setCurrentText(text);
    setDisplayedText('');
    setIsSpeaking(true);

    // Typewriter effect synced to speech
    let i = 0;
    typingRef.current = setInterval(() => {
      i++;
      setDisplayedText(text.slice(0, i));
      if (i >= text.length && typingRef.current) {
        clearInterval(typingRef.current);
      }
    }, 28);

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1.05;

    const setVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      const preferred = voices.find(
        (v) =>
          v.name.includes('Daniel') ||
          v.name.includes('Alex') ||
          v.name.includes('Google US English') ||
          (v.lang === 'en-US' && v.localService)
      );
      if (preferred) utterance.voice = preferred;
    };

    if (window.speechSynthesis.getVoices().length > 0) {
      setVoice();
    } else {
      window.speechSynthesis.addEventListener('voiceschanged', setVoice, { once: true });
    }

    utterance.onend = () => {
      setIsSpeaking(false);
      setDisplayedText(text);
      if (typingRef.current) clearInterval(typingRef.current);
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      setDisplayedText(text);
      if (typingRef.current) clearInterval(typingRef.current);
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [stopSpeaking]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: Message = { role: 'user', content: text.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);
    stopSpeaking();

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!res.ok || !res.body) throw new Error('Request failed');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        // Parse Vercel AI data stream format
        for (const line of chunk.split('\n')) {
          if (line.startsWith('0:"')) {
            try {
              const token = JSON.parse(line.slice(2));
              full += token;
            } catch { /* skip malformed */ }
          }
        }
      }

      const assistantMsg: Message = { role: 'assistant', content: full };
      setMessages((prev) => [...prev, assistantMsg]);
      speakText(full);
    } catch (err) {
      console.error(err);
      const errMsg: Message = { role: 'assistant', content: "Sorry, something went wrong. Try again." };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading, speakText, stopSpeaking]);

  useEffect(() => {
    return () => stopSpeaking();
  }, [stopSpeaking]);

  const lastAssistantMsg = [...messages].reverse().find((m) => m.role === 'assistant');

  return (
    <div className="min-h-dvh bg-black text-white flex flex-col items-center justify-start px-4 py-10">
      <div className="w-full max-w-sm flex flex-col items-center gap-6">

        {/* Header */}
        <div className="text-center">
          <p className="text-gray-500 text-xs tracking-widest uppercase mb-1">AI Avatar</p>
          <h1 className="text-xl font-semibold tracking-tight">Robin Kwee</h1>
        </div>

        {/* Talking Avatar */}
        <div className="relative flex items-center justify-center">
          {/* Outer pulse rings when speaking */}
          {isSpeaking && (
            <>
              <span className="absolute w-36 h-36 rounded-full border border-white/10 animate-ping" style={{ animationDuration: '1.2s' }} />
              <span className="absolute w-28 h-28 rounded-full border border-white/20 animate-ping" style={{ animationDuration: '0.9s' }} />
            </>
          )}

          {/* Audio bars arc — bottom */}
          {isSpeaking && (
            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 flex items-end gap-[3px]">
              {[4, 8, 13, 9, 14, 10, 6, 12, 8, 5].map((h, i) => (
                <div
                  key={i}
                  className="w-1 rounded-full bg-white/60"
                  style={{
                    height: `${h}px`,
                    animation: `audioBar 0.5s ease-in-out ${i * 0.07}s infinite alternate`,
                  }}
                />
              ))}
            </div>
          )}

          {/* Avatar image */}
          <div
            className="relative w-24 h-24 rounded-full overflow-hidden"
            style={{
              boxShadow: isSpeaking
                ? '0 0 0 3px white, 0 0 24px rgba(255,255,255,0.3)'
                : '0 0 0 2px #333',
              transition: 'box-shadow 0.3s ease',
            }}
          >
            <img
              src="/avatar.jpg"
              alt="Robin Kwee"
              className="w-full h-full object-cover"
              style={{
                transform: isSpeaking ? 'scale(1.04)' : 'scale(1)',
                transition: 'transform 0.3s ease',
              }}
            />
          </div>
        </div>

        {/* Speech bubble / response area */}
        <div className="w-full min-h-[80px] rounded-xl bg-gray-900 border border-gray-800 px-4 py-3 text-sm text-gray-200 leading-relaxed">
          {isLoading && !displayedText ? (
            <div className="flex items-center gap-1 text-gray-500">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          ) : displayedText ? (
            <p>{displayedText}{isSpeaking && <span className="animate-pulse ml-0.5 text-white">|</span>}</p>
          ) : lastAssistantMsg ? (
            <p>{lastAssistantMsg.content}</p>
          ) : (
            <p className="text-gray-600 italic">Ask me anything...</p>
          )}
        </div>

        {/* Speak/stop controls */}
        {lastAssistantMsg && !isLoading && (
          <div className="flex gap-2 w-full">
            <button
              onClick={() => isSpeaking ? stopSpeaking() : speakText(lastAssistantMsg.content)}
              className="flex-1 py-2 text-xs rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
            >
              {isSpeaking ? '⏹ Stop' : '▶ Replay'}
            </button>
          </div>
        )}

        {/* Starter questions */}
        {messages.length === 0 && (
          <div className="w-full grid grid-cols-2 gap-2">
            {STARTER_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => sendMessage(q)}
                className="text-left text-xs px-3 py-2.5 rounded-lg border border-gray-800 text-gray-400 hover:border-gray-600 hover:text-gray-200 transition-colors leading-snug"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <form
          className="w-full flex gap-2"
          onSubmit={(e) => { e.preventDefault(); sendMessage(input); }}
        >
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Robin something..."
            className="flex-1 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-gray-600 transition-colors"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-4 py-2 rounded-lg bg-white text-black text-sm font-medium disabled:opacity-30 hover:bg-gray-200 transition-colors"
          >
            Ask
          </button>
        </form>

        {/* Conversation history */}
        {messages.length > 0 && (
          <div className="w-full space-y-2 pt-2 border-t border-gray-900">
            {messages.slice(-6).map((m, i) => (
              <div key={i} className={`text-xs ${m.role === 'user' ? 'text-gray-500 text-right' : 'text-gray-600'}`}>
                <span className={m.role === 'user' ? 'bg-gray-900 px-2 py-1 rounded-lg inline-block' : ''}>
                  {m.role === 'user' ? m.content : ''}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Back link */}
        <a href="/" className="text-gray-700 text-xs hover:text-gray-500 transition-colors mt-2">
          ← Back to profile
        </a>
      </div>

      <style>{`
        @keyframes audioBar {
          from { transform: scaleY(0.4); }
          to   { transform: scaleY(1.6); }
        }
      `}</style>
    </div>
  );
}
