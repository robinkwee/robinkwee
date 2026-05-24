# TODOS

## V2: Rate Limiting (Upstash)
**What:** Add `@upstash/ratelimit` to `app/api/chat/route.ts` using `x-forwarded-for` header as the rate limit key.
**Why:** Public endpoint with no auth. If the page gets scraped or shared widely, unprotected streaming calls to OpenAI accumulate.
**Context:**
- Use `x-forwarded-for` header, NOT `request.ip` — on Vercel Edge, `request.ip` returns Vercel's own proxy IP, not the visitor's. All users would share one bucket.
  ```ts
  const ip = request.headers.get('x-forwarded-for') ?? 'unknown';
  ```
- Use `@upstash/redis` HTTP client (not TCP) — TCP Redis clients are banned on the Edge runtime.
- Suggested limit: 20 requests/hour per IP.
- Upstash free tier handles ~10k requests/day — sufficient for a personal page.
**Depends on:** V1 shipped and live at a real URL.

---

## Layer 2: Social Sync Widget
**What:** Embed a social aggregator widget (Juicer.io or EmbedSocial) to pull in Instagram and Facebook activity onto the profile page.
**Why:** Closes the social sync goal from the original design. Live content without Robin manually updating anything.
**Context:**
- LinkedIn removed personal profile read API access in 2024. Native LinkedIn integration is not available. Widget only.
- Juicer.io: free for 14 days, then paid. EmbedSocial has a similar model.
- Alternative: build a simple static "recent work" section (manually updated) instead of a widget — simpler, no ongoing cost.
**Depends on:** V1 shipped with AI chat working.
