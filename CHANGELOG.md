# Changelog

All notable changes to this project will be documented in this file.

## [0.2.0.0] - 2026-09-15

Production hardening pass. Two of these were site-wide breakages, not polish.

### Fixed
- **Root layout emitted no `<html>` or `<body>`** — `app/layout.tsx` returned a bare `<div>`, so every page shipped malformed HTML with no `lang` attribute, and `/old` rendered a second `<html>` element nested inside the document. The root layout now owns the document; `app/old/layout.tsx` is a plain nested layout.
- **Tailwind never loaded outside `/old`** — `globals.css` (the Tailwind entry) was only imported by the archived layout, so `/call`, `/log`, `/blog` and `/blog/[slug]` rendered completely unstyled. The import moved to the root layout.
- **Google Meet link put the two parties in different meetings** — `MEET_LINK` defaulted to `https://meet.google.com/new`, which creates a fresh room for every person who opens it. That URL is now rejected outright; without a configured permanent room the invite promises a link instead of shipping a broken one.
- **Calendar invites broke on ordinary input** — the `.ics` writer interpolated names and topics without RFC 5545 escaping or line folding, so "Smith, Jane" produced an invite clients silently refused, and a newline could inject arbitrary calendar properties.
- **Agent replies lost words mid-sentence** — the stream reader split each network chunk on newlines in isolation, dropping any line that straddled a chunk boundary. Stream errors and tool results were ignored entirely, so a failed booking looked identical to a successful one.
- **Activity streaks were wrong after a day off** — `computeStreaks` used a sign-flip sentinel that relied on `-0 >= 0` being false. It is true, so a missed day reported the previous run as the current streak, and a broken streak silently resumed.
- **Log dates drifted by a day** — "day N of the year" and streak boundaries used UTC dates while everything else is quoted in Manila time.
- **Reminder emails could be scheduled in the past** for calls booked close to their start time.
- Landing page: the "Prefer the classic?" footer link pointed at itself instead of `/old`; the nav still read "/2" from when the page lived there.
- Blog and archive page titles were doubling the "— Robin Kwee" suffix.

### Added
- **Self-service booking form on `/call`** — always available, no microphone required, with live availability, inline validation and a confirmation card. Booking previously worked only by talking to Aria, which failed outright in Firefox and every non-Safari browser on iOS.
- **Typed input during the voice call**, a transcript view, and explicit handling for blocked or missing microphones.
- **`GET`/`POST /api/book`** — availability and booking behind one set of validated rules (`lib/booking/schema.ts`) shared by the form, the API and the agent's tool.
- **Double-booking and duplicate protection** — slots are claimed before any email is sent and released if the confirmation fails. Supabase-backed when configured (`supabase/migrations/0001_bookings.sql`), per-instance otherwise.
- **Rate limiting on every public route** (`lib/rate-limit.ts`), backed by Upstash Redis when configured. Booking attempts, successful bookings per IP, and invitations per recipient address are capped separately, so a typo in the form never costs somebody their ability to book.
- Security headers, `sitemap.xml`, `robots.txt`, OpenGraph/Twitter metadata, a custom 404, and route + root error boundaries.
- `.env.example` documenting every environment variable, and `supabase/` schema notes.
- `npm run check` (lint + typecheck + tests) and a `test` script; 93 new tests covering slot rules, iCalendar output, booking, streaks, rate limiting and the booking route.

### Security
- `/api/habits/workout` logged the first six characters of the shared secret and reported whether it was configured in its 401 body. Both removed; the comparison is now constant-time.
- `/api/chat` and `/api/call-agent` forwarded the request body to the model verbatim, so a caller could inject `system` turns or fabricate tool results. Roles are whitelisted and content is bounded.
- Caller-supplied text is HTML-escaped in every email rather than interpolated raw into Robin's inbox.
- Removed `/api/avatar-chat` and `/api/tts` — unreferenced, unauthenticated proxies to Anthropic and ElevenLabs that anyone could bill.
- `/api/kokoro` now caps input length; `/api/habits` bounds the `year` parameter.
- Client IP is read from the last forwarded hop rather than the first, which a caller controls.

### Changed
- Renamed GENAIO venture to PeopleDrivenAI; updated link from `genaio.org` to `peopledrivenai.org` across landing and profile pages, and added it to the AI assistant's context, which still described the old venture list.
- The landing intro overlay now always clears — on a GSAP failure, and via a failsafe timer — and is hidden entirely when scripting is off. It was a full-screen opaque overlay that only JavaScript could remove.
- Removed dead duplicates of `ProfilePage.tsx`, `SkyBackground.tsx` and `globals.css` left at `app/` root by the V2 promotion.

## [0.1.3.0] - 2026-06-12

### Added
- New profile landing page at `/2` — an awwwards-style experience with a Three.js particle scene that morphs through four shapes (sphere → cloud → wave grid → torus) as you scroll, driven by custom GLSL shaders with 9 000 particles on desktop
- GSAP-powered entrance animation: a preloader counter ticks 000→100, curtain wipes away, then the hero name and supporting text char-reveal into view
- Scroll-driven animations throughout: thesis word-by-word reveals, venture cascade, 365-day activity counter, and a heatmap of daily work
- Live Manila clock in the nav bar and fully responsive layout down to 375 px
- Instrument Serif typeface for editorial headings; custom cursor with blend-mode difference effect on desktop
- Graceful degradation: particle scene uses a try/catch WebGL guard so the page loads cleanly on any device; `prefers-reduced-motion` disables all animations
- Added `gsap` (3.15.0) and `three` (0.184.0) runtime dependencies

## [0.1.2.0] - 2026-05-30

### Added
- Animated night-sky background — a rotating starfield with a faint Milky Way band sits behind the profile, with the "i" in "Robin Kwee" anchoring the north star the sky turns around. Respects reduced-motion and pauses when the tab is hidden.

### Changed
- Profile now defaults to a dark sky gradient instead of solid black, with the content panel lifted above the stars on a subtle blur.

## [0.1.1.2] - 2026-05-26

### Removed
- AI avatar demo page (`/avatar`) — removed the Charlie Munger AI persona page and its link from the profile

## [0.1.1.1] - 2026-05-26

### Added
- GENAIO.org venture link — AI translation layer for Filipino business
- Ecommerce tag for DigitalNuvo, replacing the AI tag

## [0.1.1.0] - 2026-05-26

### Added
- Profile photo — real headshot replaces the "RK" gradient placeholder
- AI avatar demo page at `/avatar` — talk to Robin's AI persona with voice synthesis; the avatar animates while speaking
- "Talk to my AI avatar" link on the profile page with photo thumbnail

## [0.1.0.0] - 2026-05-25

### Added
- AI-first personal profile page with venture cards and social links
- Blog with Recent Writing section
- Activity log — 365-day heatmap tracking workouts and habits via `/log`
- AI chat widget powered by Claude (Haiku) with Robin's persona as system prompt
- Workout/habits API endpoints
