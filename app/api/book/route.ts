import { bookCall } from '@/lib/booking';
import {
  ALLOWED_DURATIONS,
  BUSINESS_DAYS,
  DEFAULT_DURATION_MINUTES,
  MAX_DAYS_AHEAD,
  manilaParts,
  manilaWallClockToDate,
  slotsForDate,
} from '@/lib/booking/schema';
import { listBookings } from '@/lib/booking/store';
import { clientIp, json, tooManyRequests } from '@/lib/http';
import { peekRateLimit, rateLimit, rateLimitHeaders } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 20;

const HOUR_MS = 60 * 60_000;

/**
 * Two separate ceilings.
 *
 * `attempt` stops someone hammering the endpoint and is generous, because
 * fixing a typo in the form must never cost somebody their ability to book.
 * `quota` is charged only when a booking actually succeeds, which is the one
 * that sends mail on Robin's behalf. The per-email quota is what stops the
 * endpoint being used to bomb a third party's inbox with invitations.
 */
const ATTEMPT_LIMIT = 30;
const QUOTA_PER_IP = 5;
const QUOTA_PER_EMAIL = 3;
const AVAILABILITY_LIMIT = 60;
const AVAILABILITY_WINDOW_MS = 60_000;

const TOO_MANY_BOOKINGS =
  'You have booked several calls already. Email robinkwee@gmail.com if you need another.';

/**
 * GET /api/book?date=YYYY-MM-DD&duration=30
 * Open slots on a Manila calendar date.
 */
export async function GET(req: Request) {
  const limit = await rateLimit(
    `avail:${clientIp(req)}`,
    AVAILABILITY_LIMIT,
    AVAILABILITY_WINDOW_MS
  );
  if (!limit.ok) {
    return tooManyRequests(limit.retryAfterSeconds, 'Too many requests. Please slow down.');
  }

  const url = new URL(req.url);
  const now = new Date();
  const dateKey = url.searchParams.get('date') ?? manilaParts(now).dateKey;

  const requested = Number(url.searchParams.get('duration') ?? DEFAULT_DURATION_MINUTES);
  const durationMinutes = (ALLOWED_DURATIONS as readonly number[]).includes(requested)
    ? requested
    : DEFAULT_DURATION_MINUTES;

  const dayStart = manilaWallClockToDate(dateKey, 0, 0);
  if (!dayStart) {
    return json({ error: 'Invalid date. Use YYYY-MM-DD.' }, { status: 400 });
  }

  const dayEnd = new Date(dayStart.getTime() + 86_400_000);
  const taken = (await listBookings(dayStart.toISOString(), dayEnd.toISOString())).map((b) => ({
    start: new Date(b.start_at),
    end: new Date(b.end_at),
  }));

  return json(
    {
      date: dateKey,
      durationMinutes,
      isBusinessDay: BUSINESS_DAYS.includes(manilaParts(dayStart).weekday),
      maxDaysAhead: MAX_DAYS_AHEAD,
      slots: slotsForDate(dateKey, durationMinutes, now, taken),
    },
    { headers: rateLimitHeaders(limit) }
  );
}

/** POST /api/book — the deterministic booking path used by the form. */
export async function POST(req: Request) {
  const ip = clientIp(req);

  const attempt = await rateLimit(`book-attempt:${ip}`, ATTEMPT_LIMIT, HOUR_MS);
  if (!attempt.ok) {
    return tooManyRequests(attempt.retryAfterSeconds, 'Too many requests. Please slow down.');
  }

  const ipQuota = await peekRateLimit(`book-quota:${ip}`, QUOTA_PER_IP, HOUR_MS);
  if (!ipQuota.ok) {
    return tooManyRequests(ipQuota.retryAfterSeconds, TOO_MANY_BOOKINGS);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const email = String((body as { email?: unknown })?.email ?? '')
    .trim()
    .toLowerCase();
  if (email) {
    const emailQuota = await peekRateLimit(`book-quota-email:${email}`, QUOTA_PER_EMAIL, HOUR_MS);
    if (!emailQuota.ok) {
      return tooManyRequests(emailQuota.retryAfterSeconds, TOO_MANY_BOOKINGS);
    }
  }

  const result = await bookCall(body, { source: 'web' });

  if (!result.ok) {
    const status =
      result.code === 'slot_taken' || result.code === 'already_booked'
        ? 409
        : result.code === 'email_not_configured' || result.code === 'email_failed'
          ? 503
          : 400;
    return json(
      { error: result.error, code: result.code, fieldErrors: result.fieldErrors },
      { status, headers: rateLimitHeaders(attempt) }
    );
  }

  // Charge the quotas only now that mail has actually gone out.
  const charged = await rateLimit(`book-quota:${ip}`, QUOTA_PER_IP, HOUR_MS);
  if (email) await rateLimit(`book-quota-email:${email}`, QUOTA_PER_EMAIL, HOUR_MS);

  return json(
    {
      ok: true,
      bookingRef: result.bookingRef,
      whenManila: result.whenManila,
      startISO: result.startISO,
      durationMinutes: result.durationMinutes,
      meetLink: result.meetLink,
    },
    { status: 201, headers: rateLimitHeaders(charged) }
  );
}
