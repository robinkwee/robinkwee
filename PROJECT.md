# robinkwee.com — Project Tracker

> Robin Kwee's personal site: profile, blog, activity log, and an AI chat widget that speaks in Robin's voice.

**Single source of truth** for what this project contains, the status of every
feature, and what's planned. Update rule in `CLAUDE.md`.

**Last updated:** 2026-07-17  
**Status:** V2 promoted to main (2026-06-15)

---

## Overview

- **Vision:** A living personal site that introduces Robin, surfaces what he's building (PeopleDrivenAI, DigitalNuvo, 247 Cargo), and lets visitors *talk* to an AI version of him — not just read about him.
- **Audience:** Founders, collaborators, recruiters, and friends landing on the site from LinkedIn / venture pages.
- **Goals (now):** Keep the page fresh as ventures evolve; harden the public AI chat against abuse; selectively add interactive surfaces (avatar, call, log) without bloating the page.

---

## Current Focus

What's actively in flight right now. Update when priorities shift, not just when work lands.

- ✅ **V2 LIVE (2026-06-15)** — Landing page with particle animation is now the main experience (`/`). Original profile archived at `/old`. All routes (api, blog, call, log) preserved.
- 📋 Next: Rate limiting on `/api/chat` before traffic scales; add `@upstash/ratelimit` keyed on IP.

---

## Tech & Architecture

- **Stack:** Next.js 16 (App Router) + React 19, TypeScript, Tailwind CSS 4.
- **AI:** Claude Haiku via `@ai-sdk/anthropic` + Vercel `ai` SDK for streaming. Edge runtime for `/api/chat`.
- **Data:** Supabase (`@supabase/supabase-js`) for activity-log + habits storage; flat-file markdown for blog posts (`content/posts/`).
- **Email:** Resend (`resend`).
- **Hosting:** Vercel.
- **Repo:** GitHub `robinkwee/robinkwee`.

### Directory map

```
.
├── app/                     Next.js App Router (V2 live)
│   ├── page.tsx             Home → Landing (particle scene)
│   ├── layout.tsx           Root layout (V2)
│   ├── Landing.tsx          Animated landing experience (V2)
│   ├── ParticleScene.tsx    WebGL particle effects (V2)
│   ├── v2.css               V2 styling
│   ├── old/                 Original profile + UI (archived)
│   │   ├── page.tsx         Original home
│   │   ├── layout.tsx       Original layout
│   │   ├── ProfilePage.tsx  Original profile UI
│   │   ├── SkyBackground.tsx Original starfield background
│   │   └── globals.css      Original styles
│   ├── blog/                Blog index + dynamic [slug] + rss.xml
│   ├── log/                 365-day activity heatmap (workouts + habits)
│   ├── call/                Voice-call surface
│   └── api/
│       ├── chat/            Claude Haiku streaming chat (Edge)
│       ├── avatar-chat/     AI avatar chat backend
│       ├── call-agent/      Voice call agent
│       ├── habits/          Habits read/write (Supabase)
│       ├── tts/             Text-to-speech
│       └── kokoro/          (TTS variant)
├── content/                 Markdown blog posts + `workouts.json` source
├── lib/                     `system-prompt.ts`, `site-context.ts`, `markdown.ts`,
│                            `booking.ts`, `github-contributions.ts`, `workouts.ts`
├── public/                  Static assets (headshot, logos, favicons)
├── __tests__/               Vitest unit tests
├── jarvis-workout/          ⏸ Paused subapp — separate repo (own .git, package.json)
├── CHANGELOG.md             Per-release notes
├── PROJECT.md               ← this file
└── CLAUDE.md                Agent instructions (incl. update rule)
```

---

## Feature Inventory

Status legend: ✅ Done · 🚧 In progress · 📋 Planned

### Main site
- ✅ Profile page — venture cards (247 Cargo, PeopleDrivenAI, DigitalNuvo), headshot, social links.
- ✅ Animated night-sky background — rotating starfield + Milky Way band; "i" in "Robin Kwee" anchors the north star; respects `prefers-reduced-motion`; pauses on hidden tab.
- ✅ Blog — index + `/blog/[slug]` from markdown in `content/posts/` (remark + rehype + highlighting); `rss.xml`.
- ✅ Activity log (`/log`) — 365-day heatmap of workouts + habits.
- ✅ AI chat widget — Claude Haiku via `@ai-sdk/anthropic`, Robin's persona system prompt (`lib/system-prompt.ts`), streamed on the Edge runtime.
- ✅ Voice/call surface (`/call`) — TTS via `msedge-tts` + agent backend.
- ✅ Social links (LinkedIn + others) on profile.

---

## Roadmap / Planned Work

- 📋 **V2: Rate limiting on `/api/chat`** — add `@upstash/ratelimit` keyed on `x-forwarded-for` (NOT `request.ip`, which returns Vercel's proxy IP on Edge). Suggested limit: 20 req/hr per IP. Upstash free tier (~10k req/day) is enough.
- 📋 **Layer 2: Social-sync widget** — embed a social aggregator (Juicer.io / EmbedSocial) for Instagram + Facebook activity on the profile. LinkedIn personal-profile read API is no longer available (removed 2024) — widget only. Alternative: a manually-updated "recent work" section.

---

## Known Gaps / Tech Debt

- **Public AI chat has no rate limiting** — `/api/chat` streams to Anthropic without per-IP throttling. Real security/cost risk if the page is scraped or shared widely (see V2 in Roadmap).
- **`jarvis-workout/` subapp is paused** — separate repo with its own git history and `package.json`, embedded as a folder for convenience. Not currently built or deployed; treat as out-of-scope for this tracker.
- **README.md is the default `create-next-app` boilerplate** — never replaced. PROJECT.md is now the real front door.

---

## Deploy & Run

- **Local dev:** `npm install && npm run dev` (uses `dotenv-cli` to load `.env.local`).
- **Build / start:** `npm run build && npm start`.
- **Tests:** `npx vitest` (config in `vitest.config.ts`).
- **Hosting:** Vercel — auto-deploy from `main`.
- **Env vars (Vercel):**
  - `ANTHROPIC_API_KEY` — Claude Haiku for `/api/chat` and `/api/avatar-chat`.
  - `OPENAI_API_KEY` — `@ai-sdk/openai` fallback.
  - `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` — activity log + habits.
  - `RESEND_API_KEY` — outbound email.

---

## Changelog

Newest first. One-line entry per change.

- 2026-07-17 — Renamed GENAIO venture to PeopleDrivenAI; link updated to `peopledrivenai.org` across landing + profile.
- 2026-06-15 — **V2 LIVE** — Swapped v2 landing experience to main (`/`); original profile archived at `/old`; all routes and APIs preserved; build verified.
- 2026-06-15 — Added `PROJECT.md` (this tracker) and the project-tracking update rule in `CLAUDE.md`. Folded `TODOS.md` into Roadmap and removed it.
- 2026-05-30 — v0.1.2.0: animated night-sky background; profile defaults to dark sky gradient with blurred content panel above the stars.
- 2026-05-26 — v0.1.1.2: removed `/avatar` (Charlie Munger AI persona) demo page and its profile link.
- 2026-05-26 — v0.1.1.1: added GENAIO.org venture link; DigitalNuvo retagged Ecommerce (was AI).
- 2026-05-26 — v0.1.1.0: real headshot replaces RK placeholder; `/avatar` demo page; "Talk to my AI avatar" link on profile.
- 2026-05-25 — v0.1.0.0: initial AI-first profile (venture cards, social links), blog with Recent Writing, `/log` activity heatmap, Claude Haiku chat widget, workout/habits API.
