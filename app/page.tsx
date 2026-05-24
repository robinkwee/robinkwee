'use client';

import { useChat } from 'ai/react';
import type { Message } from 'ai';
import { useEffect, useRef } from 'react';

export default function Home() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/chat',
  });

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on load
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const hasMessages = messages.length > 0;

  return (
    <main
      className="flex flex-col bg-black text-white"
      style={{ minHeight: '100dvh' }}
    >
      {/* Conversation area */}
      <div className="flex-1 overflow-y-auto px-6 py-8 max-w-2xl mx-auto w-full">
        {!hasMessages && (
          <div className="flex flex-col justify-center" style={{ minHeight: '40dvh' }}>
            <p className="text-gray-500 text-sm tracking-widest uppercase mb-2">Robin Kwee</p>
            <h1 className="text-2xl font-light text-white leading-snug">
              What do you want to know?
            </h1>
          </div>
        )}

        {messages.map((m: Message) => (
          <div
            key={m.id}
            className={`mb-6 ${m.role === 'user' ? 'text-gray-400' : 'text-white'}`}
          >
            {m.role === 'user' && (
              <p className="text-xs text-gray-600 uppercase tracking-widest mb-1">You</p>
            )}
            <p className="leading-relaxed whitespace-pre-wrap">{m.content}</p>
          </div>
        ))}

        {isLoading && (
          <div className="mb-6">
            <span className="inline-block w-2 h-4 bg-white animate-pulse" />
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar — pinned to bottom */}
      <div className="border-t border-gray-800 px-6 py-4 max-w-2xl mx-auto w-full">
        <form onSubmit={handleSubmit} className="flex gap-3 items-center">
          <input
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            placeholder={hasMessages ? 'Ask another question...' : 'Ask me anything...'}
            disabled={isLoading}
            className="flex-1 bg-transparent text-white placeholder-gray-600 outline-none text-base caret-white"
            autoComplete="off"
            autoCorrect="off"
            spellCheck="false"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="text-gray-600 hover:text-white transition-colors text-sm disabled:opacity-30"
          >
            ↵
          </button>
        </form>
      </div>
    </main>
  );
}
