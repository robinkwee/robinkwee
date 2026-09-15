# robinkwee.com — Project Tracker

> Robin Kwee's personal site: profile, blog, activity log, call booking, and an AI chat widget that speaks in Robin's voice.

**Single source of truth** for what this project contains, the status of every
feature, and what's planned. Update rule in `CLAUDE.md`.

**Last updated:** 2026-09-15  
**Status:** V2 live on `/`; booking system rebuilt and hardened (v0.2.0.0)

---

## Overview

- **Vision:** A living personal site that introduces Robin, surfaces what he's building (PeopleDrivenAI, DigitalNuvo, 247 Cargo), and lets visitors *talk* to an AI version of him — not just read about him.
- **Audience:** Founders, collaborators, recruiters, and friends landing on the site from LinkedIn / venture pages.
- **Goals (now):** Keep the page fresh as ventures evolve; keep booking reliable and abuse-resistant; selectively add interactive surfaces without bloating the page.

---

## Current Focus

What's actively in flight right now. Update when priorities shift, not just when work lands.

- ✅ **Production hardening (2026-09-15)** — fixed the broken root layout, restored CSS on `/call`, `/log` and `/blog`, rebuilt the booking system end to end, and put rate limits on every public API route.
- 📋 Next: set `MEET_LINK` to a permanent Google Meet room and apply `supabase/migrations/0001_bookings.sql` — until both are done, invites carry no join link and bookings are not persisted.
- 📋 Then: a real Content-Security-Policy (needs nonces via middleware for GSAP's inline styles).

---

## Tech & Architecture

- **Stack:** Next.js 16 (App Router) + React 19, TypeScript, Tailwind CSS 4.
- **AI:** Claude Haiku via `@ai-sdk/anthropic` + Vercel `ai` SDK for streaming, Node runtime.
- **Data:** Supabase (`@supabase/supabase-js`) for bookings, activity-log and habits; flat-file markdown for blog posts (`content/posts/`).
- **Email:** Resend (`resend`) — booking confirmations, ICS invites, scheduled reminders.
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
│   ├── call/                Voice agent + self-service booking form
│   │   ├── page.tsx         Route + metadata
│   │   ├── CallExperience.tsx  Phone UI, speech I/O, agent stream
│   │   └── BookingForm.tsx     Deterministic booking form
│   └── api/
│       ├── book/            Availability (GET) + booking (POST)
│       ├── chat/            Claude Haiku streaming chat
│       ├── call-agent/      Voice call agent + book_call tool
│       ├── habits/          Habits read/write (Supabase)
│       └── kokoro/          Text-to-speech (Edge TTS + HF fallback)
├── content/                 Markdown blog posts + `workouts.json` source
├── lib/
│   ├── booking.ts           Booking orchestrator
│   ├── booking/schema.ts    Slot rules + input validation (shared)
│   ├── booking/ics.ts       RFC 5545 iCalendar writer
│   ├── booking/store.ts     Booking persistence + double-booking guard
│   ├── booking/email.ts     Confirmation + reminder templates
│   ├── manila.ts            Manila calendar helpers
│   ├── habits.ts            Habit grid, streaks, weekly stats
│   ├── rate-limit.ts        Fixed-window limiter (memory / Upstash)
│   ├── http.ts              Client IP, JSON helpers, message sanitising
│   └── system-prompt.ts, site-context.ts, markdown.ts,
│       github-contributions.ts, workouts.ts
├── supabase/                SQL migrations + schema notes
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
- ✅ **Self-service booking form** — always available, no microphone required; live availability, inline validation, confirmation card.
- ✅ **Aria voice agent** — speech in/out, reads the email back before booking, typed input fallback on every turn, transcript view, graceful degradation where the Web Speech API is missing.
- ✅ **Shared slot rules** (`lib/booking/schema.ts`) — weekdays 09:00–18:00 Manila, half-hour grid, 1-hour lead time, 60-day horizon, 15/30/45/60-minute durations. The form, the API and the agent's tool all validate against the same rules.
- ✅ **Double-booking + duplicate protection** — slots are claimed before any email goes out and released if the confirmation fails.
- ✅ **Spec-correct calendar invites** — RFC 5545 escaping and line folding, `method=REQUEST`, 30-minute alarm.
- ✅ **Abuse limits** — booking attempts, successful bookings per IP, and invitations per recipient address are capped separately.

### APIs
- ✅ `GET /api/book` — open slots for a Manila date.
- ✅ `POST /api/book` — validated booking, 201/400/409/429/503.
- ✅ `POST /api/chat`, `POST /api/call-agent` — rate limited, roles whitelisted, message length capped.
- ✅ `POST /api/kokoro` — Edge TTS with HF fallback, input capped.
- ✅ `GET /api/habits`, `POST /api/habits/workout` — year bounded; the write path uses a constant-time secret comparison.

---

## Roadmap / Planned Work

- 📋 **Content-Security-Policy** — needs a nonce plumbed through middleware because the landing page relies on GSAP's inline style writes and next/font's inline styles. Other security headers already ship (`next.config.ts`).
- 📋 **Cancel / reschedule links** — bookings have a stable id and reference; a signed link would let callers change a booking without emailing.
- 📋 **Real calendar availability** — slots are currently free unless this site booked them. Reading Robin's Google Calendar free/busy would stop clashes with everything booked elsewhere.
- 📋 **Layer 2: Social-sync widget** — embed a social aggregator (Juicer.io / EmbedSocial) for Instagram + Facebook activity. LinkedIn personal-profile read API is no longer available (removed 2024) — widget only.

---

## Known Gaps / Tech Debt

- **`MEET_LINK` is unset** — invites say Robin will send the link rather than carrying one. The old default (`meet.google.com/new`) is explicitly rejected because it opens a different room for each person who clicks it.
- **Bookings are not persisted until the Supabase migration is applied** — `supabase/migrations/0001_bookings.sql`. Until then double-booking protection is per serverless instance.
- **Rate limits are per-instance without Upstash** — set `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` to share counters.
- **No Content-Security-Policy** — see Roadmap.
- **`BOOKING_FROM_EMAIL` defaults to the Resend sandbox sender** — set it to an address on a verified domain or invites will land in spam.
- **README.md is the default `create-next-app` boilerplate** — PROJECT.md is the real front door.

---

## Deploy & Run

- **Local dev:** `npm install && npm run dev` (uses `dotenv-cli` to load `.env.local`; copy `.env.example` to start).
- **Build / start:** `npm run build && npm start`.
- **Checks:** `npm run check` (lint + typecheck + tests). Individually: `npm run lint`, `npm run typecheck`, `npm test`.
- **Database:** apply `supabase/migrations/` — see `supabase/README.md`.
- **Hosting:** Vercel — auto-deploy from `main`.
- **Env vars:** every variable is documented in `.env.example`. The ones production needs are `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `MEET_LINK`, `BOOKING_FROM_EMAIL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

---

## Changelog

Newest first. One-line entry per change.

- 2026-09-15 — v0.2.0.0: fixed the root layout (no `<html>`/`<body>` was emitted and Tailwind never loaded on `/call`, `/log` or `/blog`); rebuilt booking with a self-service form, shared slot rules, double-booking protection and spec-correct invites; rate limited every public API; removed the unused `/api/avatar-chat` and `/api/tts` proxies; fixed the streak calculation; added security headers, sitemap, robots, 404 and error boundaries.
- 2026-07-17 — Renamed GENAIO venture to PeopleDrivenAI; link updated to `peopledrivenai.org` across landing + profile.
- 2026-06-15 — **V2 LIVE** — Swapped v2 landing experience to main (`/`); original profile archived at `/old`; all routes and APIs preserved; build verified.
- 2026-06-15 — Added `PROJECT.md` (this tracker) and the project-tracking update rule in `CLAUDE.md`. Folded `TODOS.md` into Roadmap and removed it.
- 2026-05-30 — v0.1.2.0: animated night-sky background; profile defaults to dark sky gradient with blurred content panel above the stars.
- 2026-05-26 — v0.1.1.2: removed `/avatar` (Charlie Munger AI persona) demo page and its profile link.
- 2026-05-26 — v0.1.1.1: added GENAIO.org venture link; DigitalNuvo retagged Ecommerce (was AI).
- 2026-05-26 — v0.1.1.0: real headshot replaces RK placeholder; `/avatar` demo page; "Talk to my AI avatar" link on profile.
- 2026-05-25 — v0.1.0.0: initial AI-first profile (venture cards, social links), blog with Recent Writing, `/log` activity heatmap, Claude Haiku chat widget, workout/habits API.
