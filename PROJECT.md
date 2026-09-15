# robinkwee.com — Project Tracker

> Robin Kwee's personal site: profile, blog, activity log, call booking, and an AI chat widget that speaks in Robin's voice.

**Single source of truth** for what this project contains, the status of every
feature, and what's planned. Update rule in `CLAUDE.md`.

**Last updated:** 2026-09-15  
**Status:** V2 live on `/`; layout fixed and booking moved to Calendly (v0.2.0.0)

---

## Overview

- **Vision:** A living personal site that introduces Robin, surfaces what he's building (PeopleDrivenAI, DigitalNuvo, 247 Cargo), and lets visitors *talk* to an AI version of him — not just read about him.
- **Audience:** Founders, collaborators, recruiters, and friends landing on the site from LinkedIn / venture pages.
- **Goals (now):** Keep the page fresh as ventures evolve; keep booking reliable and abuse-resistant; selectively add interactive surfaces without bloating the page.

---

## Current Focus

What's actively in flight right now. Update when priorities shift, not just when work lands.

- ✅ **Production hardening (2026-09-15)** — fixed the broken root layout, restored CSS on `/call`, `/log` and `/blog`, and put rate limits on every public API route.
- ✅ **Booking moved to Calendly (2026-09-15)** — Calendly owns availability, invites, the Meet link, reminders and rescheduling. The custom booking system and the Aria voice agent were removed.
- 📋 Next: set `NEXT_PUBLIC_CALENDLY_URL` in Vercel and redeploy — until then `/call` shows an email fallback instead of a calendar.
- 📋 Then: a real Content-Security-Policy (needs nonces via middleware for GSAP's inline styles).

---

## Tech & Architecture

- **Stack:** Next.js 16 (App Router) + React 19, TypeScript, Tailwind CSS 4.
- **AI:** Claude Haiku via `@ai-sdk/anthropic` + Vercel `ai` SDK for streaming, Node runtime.
- **Booking:** Calendly, embedded on `/call` via its inline widget. Calendly owns availability, confirmation email, calendar invite, Google Meet link, reminders and rescheduling — the site stores no booking data.
- **Data:** Supabase (`@supabase/supabase-js`) for workouts behind the activity log; flat-file markdown for blog posts (`content/posts/`).
- **Rate limiting:** in-process fixed windows, backed by Upstash Redis REST when configured (`lib/rate-limit.ts`).
- **Hosting:** Vercel.
- **Repo:** GitHub `robinkwee/robinkwee`.

### Directory map

```
.
├── app/                     Next.js App Router
│   ├── layout.tsx           Root layout — owns <html>/<body>, fonts, site metadata
│   ├── page.tsx             Home → Landing (particle scene)
│   ├── Landing.tsx          Animated landing experience
│   ├── ParticleScene.tsx    WebGL particle effects
│   ├── globals.css          Tailwind entry + base document styles
│   ├── v2.css               Landing-specific styling (scoped under .v2-root)
│   ├── not-found.tsx        Custom 404
│   ├── error.tsx            Route error boundary
│   ├── global-error.tsx     Root-layout error boundary
│   ├── robots.ts            robots.txt
│   ├── sitemap.ts           sitemap.xml
│   ├── old/                 Original profile + UI (archived at /old)
│   ├── blog/                Blog index + dynamic [slug] + rss.xml
│   ├── log/                 365-day activity heatmap (workouts + habits)
│   ├── call/                Calendly booking page
│   │   ├── page.tsx         Route, metadata, unconfigured fallback
│   │   └── CalendlyEmbed.tsx   Inline widget + blocked-script fallback
│   └── api/
│       ├── chat/            Claude Haiku streaming chat
│       └── habits/          Habits read/write (Supabase)
├── content/                 Markdown blog posts + `workouts.json` source
├── lib/
│   ├── calendly.ts          Scheduling-link validation + embed params
│   ├── manila.ts            Manila calendar helpers
│   ├── habits.ts            Habit grid, streaks, weekly stats
│   ├── rate-limit.ts        Fixed-window limiter (memory / Upstash)
│   ├── http.ts              Client IP, JSON helpers, message sanitising
│   └── system-prompt.ts, markdown.ts, github-contributions.ts, workouts.ts
├── supabase/                Schema notes
├── public/                  Static assets (headshot, logos, favicons)
├── __tests__/               Vitest unit + route tests
├── .env.example             Every environment variable, documented
├── CHANGELOG.md             Per-release notes
├── PROJECT.md               ← this file
└── CLAUDE.md                Agent instructions (incl. update rule)
```

---

## Feature Inventory

Status legend: ✅ Done · 🚧 In progress · 📋 Planned

### Main site
- ✅ Landing page — animated particle scene, venture rows, thesis, contact. Intro overlay has a failsafe so a GSAP failure can never leave the page blank or scroll-locked; hidden entirely when scripting is off.
- ✅ Blog — index + `/blog/[slug]` from markdown in `content/posts/` (remark + rehype + highlighting); `rss.xml`.
- ✅ Activity log (`/log`) — 365-day heatmap of workouts + habits, Manila-local dates and streaks.
- ✅ AI chat widget — Claude Haiku, Robin's persona (`lib/system-prompt.ts`), rate limited per IP.
- ✅ Archived V1 profile at `/old`.

### Booking (`/call`)
- ✅ **Calendly inline embed** — availability, confirmation, calendar invite, Google Meet link, reminders and rescheduling are all Calendly's. Themed to the site's palette via embed parameters.
- ✅ **Degrades honestly** — a blocked widget (privacy extensions routinely block Calendly) collapses to a direct "Open the booking page" button rather than a screen-high hole; no JavaScript gets a plain link; an unset or invalid `NEXT_PUBLIC_CALENDLY_URL` shows an email call-to-action instead of an empty embed.
- ✅ **Origin is validated** (`lib/calendly.ts`) — only `https://calendly.com` links are embedded, so a misconfigured variable cannot point the page's iframe somewhere else.

### APIs
- ✅ `POST /api/chat` — rate limited, roles whitelisted, message length capped.
- ✅ `GET /api/habits`, `POST /api/habits/workout` — year bounded; the write path uses a constant-time secret comparison.

---

## Roadmap / Planned Work

- 📋 **Content-Security-Policy** — needs a nonce plumbed through middleware because the landing page relies on GSAP's inline style writes and next/font's inline styles. Other security headers already ship (`next.config.ts`).
- 📋 **Layer 2: Social-sync widget** — embed a social aggregator (Juicer.io / EmbedSocial) for Instagram + Facebook activity. LinkedIn personal-profile read API is no longer available (removed 2024) — widget only.

---

## Known Gaps / Tech Debt

- **`NEXT_PUBLIC_CALENDLY_URL` is unset** — `/call` shows an email call-to-action instead of a calendar until it is set in Vercel. It is inlined at build time, so setting it needs a redeploy.
- **Rate limits are per-instance without Upstash** — set `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` to share counters.
- **No Content-Security-Policy** — see Roadmap. Note the `/call` embed needs `assets.calendly.com` (script) and `calendly.com` (frame) allowed whenever one is written.
- **Booking data lives only in Calendly** — deliberate, but it means the site cannot report on or display upcoming calls.
- **README.md is the default `create-next-app` boilerplate** — PROJECT.md is the real front door.

---

## Deploy & Run

- **Local dev:** `npm install && npm run dev` (uses `dotenv-cli` to load `.env.local`; copy `.env.example` to start).
- **Build / start:** `npm run build && npm start`.
- **Checks:** `npm run check` (lint + typecheck + tests). Individually: `npm run lint`, `npm run typecheck`, `npm test`.
- **Database:** see `supabase/README.md` (one `workouts` table, used by `/log`).
- **Hosting:** Vercel — auto-deploy from `main`.
- **Env vars:** every variable is documented in `.env.example`. The ones production needs are `NEXT_PUBLIC_CALENDLY_URL`, `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

---

## Changelog

Newest first. One-line entry per change.

- 2026-09-15 — v0.2.0.0: fixed the root layout (no `<html>`/`<body>` was emitted and Tailwind never loaded on `/call`, `/log` or `/blog`); moved booking to Calendly and removed the custom booking system and Aria voice agent; rate limited every public API; removed the unused `/api/avatar-chat` and `/api/tts` proxies; fixed the streak calculation; added security headers, sitemap, robots, 404 and error boundaries.
- 2026-07-17 — Renamed GENAIO venture to PeopleDrivenAI; link updated to `peopledrivenai.org` across landing + profile.
- 2026-06-15 — **V2 LIVE** — Swapped v2 landing experience to main (`/`); original profile archived at `/old`; all routes and APIs preserved; build verified.
- 2026-06-15 — Added `PROJECT.md` (this tracker) and the project-tracking update rule in `CLAUDE.md`. Folded `TODOS.md` into Roadmap and removed it.
- 2026-05-30 — v0.1.2.0: animated night-sky background; profile defaults to dark sky gradient with blurred content panel above the stars.
- 2026-05-26 — v0.1.1.2: removed `/avatar` (Charlie Munger AI persona) demo page and its profile link.
- 2026-05-26 — v0.1.1.1: added GENAIO.org venture link; DigitalNuvo retagged Ecommerce (was AI).
- 2026-05-26 — v0.1.1.0: real headshot replaces RK placeholder; `/avatar` demo page; "Talk to my AI avatar" link on profile.
- 2026-05-25 — v0.1.0.0: initial AI-first profile (venture cards, social links), blog with Recent Writing, `/log` activity heatmap, Claude Haiku chat widget, workout/habits API.
