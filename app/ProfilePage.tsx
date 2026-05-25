'use client';

import Link from 'next/link';
import { useChat } from 'ai/react';
import type { Message } from 'ai';
import { useEffect, useRef, useState } from 'react';
import type { PostMeta } from '@/lib/markdown';

const VENTURES = [
  {
    label: 'robinkwee.com',
    desc: 'Personal website',
    href: 'http://robinkwee.com/',
    tag: null,
  },
  {
    label: 'DigitalNuvo',
    desc: 'AI Systems That Run Your Practice',
    href: 'https://digitalnuvo.com/',
    tag: 'Ecommerce',
  },
  {
    label: 'GENAIO',
    desc: 'The AI translation layer for Filipino business',
    href: 'https://genaio.org',
    tag: 'AI',
  },
  {
    label: 'PROSMASH',
    desc: 'Padel Club · Makati & Alabang',
    href: 'https://prosmash.ph/',
    tag: 'Padel',
  },
  {
    label: 'Padel League Philippines',
    desc: 'Building the PH padel community',
    href: 'https://padelph.com/',
    tag: 'Padel',
  },
  {
    label: 'JarvisHealth',
    desc: 'Track food with friends on Telegram',
    href: 'https://rkjarvishealth.netlify.app/',
    tag: 'Health',
  },
];

const TAG_COLORS: Record<string, string> = {
  AI: 'bg-violet-900/60 text-violet-300 border-violet-800/50',
  Ecommerce: 'bg-blue-900/60 text-blue-300 border-blue-800/50',
  Padel: 'bg-emerald-900/60 text-emerald-300 border-emerald-800/50',
  Health: 'bg-amber-900/60 text-amber-300 border-amber-800/50',
};

const SOCIALS = [
  {
    label: 'WhatsApp',
    href: 'https://api.whatsapp.com/send?phone=639178482217',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-[18px] h-[18px]">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
      </svg>
    ),
  },
  {
    label: 'Facebook',
    href: 'https://www.facebook.com/robinkwee',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-[18px] h-[18px]">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
  },
  {
    label: 'Instagram',
    href: 'https://instagram.com/robinkwee',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-[18px] h-[18px]">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
      </svg>
    ),
  },
  {
    label: 'Email',
    href: 'mailto:robinkwee@gmail.com',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-[18px] h-[18px]">
        <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
      </svg>
    ),
  },
  {
    label: 'LinkedIn',
    href: 'https://linkedin.com/in/robinkwee',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-[18px] h-[18px]">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
  },
];

interface Props {
  recentPosts: PostMeta[];
}

export default function ProfilePage({ recentPosts }: Props) {
  const [chatOpen, setChatOpen] = useState(false);
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/chat',
  });
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (chatOpen) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, chatOpen]);

  useEffect(() => {
    if (chatOpen) inputRef.current?.focus();
  }, [chatOpen]);

  return (
    <main className="bg-black min-h-dvh text-white">
      <div className="max-w-sm mx-auto px-5 pt-10 pb-16">

        {/* Avatar & name */}
        <div className="flex flex-col items-center text-center mb-8">
          <img
            src="/avatar.jpg"
            alt="Robin Kwee"
            width={80}
            height={80}
            className="w-20 h-20 rounded-full object-cover border border-gray-700 mb-4"
          />
          <h1 className="text-xl font-semibold tracking-tight mb-1">Robin Kwee</h1>
          <p className="text-gray-500 text-xs mb-2">🇵🇭 Philippines</p>
          <p className="text-gray-500 text-xs tracking-wide">
            Ecommerce · Padel · Farming · Coding · Systems
          </p>
        </div>

        {/* Socials */}
        <div className="flex justify-center gap-5 mb-8">
          {SOCIALS.map((s) => (
            <a
              key={s.label}
              href={s.href}
              aria-label={s.label}
              className="text-gray-600 hover:text-white transition-colors"
            >
              {s.icon}
            </a>
          ))}
        </div>

        {/* Bio */}
        <p className="text-gray-400 text-sm leading-relaxed text-center mb-8 px-2">
          Applying AI to physical-world businesses — logistics, sports, health, distribution.
          Building infrastructure where the gap between what AI can do and what incumbents
          do is massive.
        </p>

        {/* What I&apos;m building chips */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {['AI Automation', 'Padel in PH', 'Health Tracking', 'E-commerce'].map((chip) => (
            <span
              key={chip}
              className="text-xs text-gray-500 border border-gray-800 rounded-full px-3 py-1"
            >
              {chip}
            </span>
          ))}
        </div>

        {/* Ventures */}
        <div className="space-y-2.5 mb-8">
          {VENTURES.map((v) => (
            <a
              key={v.label}
              href={v.href}
              target={v.href.startsWith('http') ? '_blank' : undefined}
              rel={v.href.startsWith('http') ? 'noopener noreferrer' : undefined}
              className="flex items-center justify-between w-full bg-[#111] hover:bg-[#181818] border border-gray-800 hover:border-gray-700 rounded-xl px-4 py-3.5 transition-all group"
            >
              <div className="flex-1 min-w-0">
                <span className="font-medium text-white text-sm block truncate">{v.label}</span>
                {v.desc && <span className="text-gray-500 text-xs">{v.desc}</span>}
              </div>
              <div className="flex items-center gap-2 ml-3 shrink-0">
                {v.tag && (
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                      TAG_COLORS[v.tag] ?? 'bg-gray-800 text-gray-400 border-gray-700'
                    }`}
                  >
                    {v.tag}
                  </span>
                )}
                <svg
                  className="w-4 h-4 text-gray-700 group-hover:text-gray-500 transition-colors"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </a>
          ))}
        </div>

        {/* AI demos */}
        <div className="flex gap-2 mb-3">
          <Link
            href="/avatar"
            className="flex-1 flex items-center justify-between bg-[#111] hover:bg-[#181818] border border-gray-800 hover:border-gray-700 rounded-xl px-3 py-3 transition-all group"
          >
            <div className="flex items-center gap-2">
              <img src="/avatar.jpg" alt="" className="w-5 h-5 rounded-full object-cover opacity-80" />
              <span className="text-xs font-medium text-white">AI avatar</span>
            </div>
            <svg className="w-3 h-3 text-gray-700 group-hover:text-gray-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
          <Link
            href="/call"
            className="flex-1 flex items-center justify-between bg-[#111] hover:bg-[#181818] border border-gray-800 hover:border-gray-700 rounded-xl px-3 py-3 transition-all group"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm">📞</span>
              <span className="text-xs font-medium text-white">Call agent</span>
            </div>
            <svg className="w-3 h-3 text-gray-700 group-hover:text-gray-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        {/* Proof of Work */}
        <Link
          href="/log"
          className="flex items-center justify-between w-full bg-[#111] hover:bg-[#181818] border border-gray-800 hover:border-gray-700 rounded-xl px-4 py-3.5 transition-all group mb-8"
        >
          <div className="flex items-center gap-3">
            <div className="flex gap-0.5">
              <span className="w-2 h-2 rounded-sm bg-violet-400 opacity-80" />
              <span className="w-2 h-2 rounded-sm bg-emerald-400 opacity-80" />
              <span className="w-2 h-2 rounded-sm bg-amber-400 opacity-80" />
            </div>
            <span className="text-sm font-medium text-white">365 days of showing up</span>
          </div>
          <svg className="w-4 h-4 text-gray-700 group-hover:text-gray-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
          </svg>
        </Link>

        {/* Recent Writing */}
        {recentPosts.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-medium text-gray-500 uppercase tracking-widest">
                Recent Writing
              </h2>
              <Link
                href="/blog"
                className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
              >
                All posts →
              </Link>
            </div>
            <div className="space-y-2">
              {recentPosts.map((post) => (
                <Link
                  key={post.slug}
                  href={`/blog/${post.slug}`}
                  className="flex items-center justify-between w-full bg-[#111] hover:bg-[#181818] border border-gray-800 hover:border-gray-700 rounded-xl px-4 py-3 transition-all group"
                >
                  <span className="text-sm text-gray-300 group-hover:text-white transition-colors truncate">
                    {post.title}
                  </span>
                  <span className="text-xs text-gray-600 shrink-0 ml-3">
                    {new Date(post.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Chat with Robin AI */}
        <div className="border border-gray-800 rounded-xl overflow-hidden mb-10">
          <button
            onClick={() => setChatOpen((o) => !o)}
            className="w-full flex items-center justify-between px-4 py-3.5 bg-[#111] hover:bg-[#181818] transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0" />
              <span className="text-sm font-medium text-white">Chat with Robin AI</span>
              <span className="text-xs text-gray-600">Ask me anything</span>
            </div>
            <svg
              className={`w-4 h-4 text-gray-600 transition-transform shrink-0 ${chatOpen ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {chatOpen && (
            <div className="bg-black border-t border-gray-800">
              <div className="px-4 py-4 min-h-[80px] max-h-72 overflow-y-auto space-y-3">
                {messages.length === 0 && (
                  <p className="text-gray-600 text-xs text-center py-3">
                    Ask about my businesses, background, or what I&apos;m building.
                  </p>
                )}
                {messages.map((m: Message) => (
                  <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {m.role === 'user' ? (
                      <span className="bg-gray-800 rounded-2xl rounded-tr-sm px-3 py-2 text-sm text-white max-w-[80%]">
                        {m.content}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-300 max-w-[90%] leading-relaxed">
                        {m.content}
                      </span>
                    )}
                  </div>
                ))}
                {isLoading && (
                  <div className="flex gap-1 items-center pl-1">
                    {[0, 150, 300].map((delay) => (
                      <span
                        key={delay}
                        className="w-1.5 h-1.5 bg-gray-600 rounded-full animate-bounce"
                        style={{ animationDelay: `${delay}ms` }}
                      />
                    ))}
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              <div className="border-t border-gray-800 px-4 py-3">
                <form onSubmit={handleSubmit} className="flex gap-2 items-center">
                  <input
                    ref={inputRef}
                    value={input}
                    onChange={handleInputChange}
                    placeholder="Ask something..."
                    disabled={isLoading}
                    className="flex-1 bg-transparent text-white placeholder-gray-700 outline-none text-sm caret-white"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                  <button
                    type="submit"
                    disabled={isLoading || !input.trim()}
                    className="text-gray-600 hover:text-white transition-colors disabled:opacity-30"
                    aria-label="Send"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center">
          <a
            href="mailto:robinkwee@gmail.com"
            className="text-gray-700 hover:text-gray-400 text-xs transition-colors"
          >
            robinkwee@gmail.com
          </a>
        </div>

      </div>
    </main>
  );
}
