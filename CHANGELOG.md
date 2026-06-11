# Changelog

All notable changes to this project will be documented in this file.

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
