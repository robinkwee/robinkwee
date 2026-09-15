import { z } from 'zod';
import { manilaParts, manilaWallClockToDate, MANILA_TZ } from '../manila';

/**
 * Booking rules — the single source of truth shared by the web form, the
 * voice agent's tool, and the API route. Every path validates against these,
 * so a caller cannot get a slot the form would have refused.
 */

export {
  MANILA_TZ,
  MANILA_OFFSET_MINUTES,
  manilaParts,
  manilaToday,
  manilaWallClockToDate,
  formatManila,
  formatManilaWithZone,
} from '../manila';

/** First slot may start at 09:00 Manila; the last must END by 18:00. */
export const BUSINESS_START_HOUR = 9;
export const BUSINESS_END_HOUR = 18;
/** Slots are offered on the hour and the half hour. */
export const SLOT_GRANULARITY_MINUTES = 30;
export const ALLOWED_DURATIONS = [15, 30, 45, 60] as const;
export const DEFAULT_DURATION_MINUTES = 30;
/** Enough lead time for Robin to actually see the invite. */
export const MIN_LEAD_MINUTES = 60;
export const MAX_DAYS_AHEAD = 60;
/** Weekdays only (0 = Sunday). */
export const BUSINESS_DAYS = [1, 2, 3, 4, 5];

export type Duration = (typeof ALLOWED_DURATIONS)[number];

// ── Input validation ───────────────────────────────────────────────────────

const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;

/**
 * Strips control characters. They are invisible, break the iCalendar line
 * grammar, and are the payload for header/content injection.
 */
const cleanText = (value: string) =>
  value.replace(CONTROL_CHARS, ' ').replace(/\s+/g, ' ').trim();

export const bookingInputSchema = z.object({
  name: z
    .string()
    .transform(cleanText)
    .pipe(z.string().min(2, 'Please give your full name.').max(80, 'Name is too long.')),
  email: z
    .string()
    .transform((v) => cleanText(v).toLowerCase())
    .pipe(z.string().email('That does not look like a valid email address.').max(254)),
  startISO: z.string().min(10).max(40),
  durationMinutes: z.coerce
    .number()
    .int()
    .refine(
      (d): d is Duration => (ALLOWED_DURATIONS as readonly number[]).includes(d),
      `Duration must be one of ${ALLOWED_DURATIONS.join(', ')} minutes.`
    )
    .default(DEFAULT_DURATION_MINUTES),
  topic: z
    .string()
    .transform(cleanText)
    .pipe(
      z
        .string()
        .min(2, 'Tell Robin what the call is about.')
        .max(140, 'Please keep the topic under 140 characters.')
    ),
});

export type BookingInput = z.infer<typeof bookingInputSchema>;

// ── Slot validation ────────────────────────────────────────────────────────

export type SlotError =
  | 'invalid_datetime'
  | 'too_soon'
  | 'too_far_ahead'
  | 'outside_business_days'
  | 'outside_business_hours'
  | 'not_on_grid';

export type SlotCheck =
  | { ok: true; start: Date; end: Date }
  | { ok: false; code: SlotError; message: string };

const SLOT_MESSAGES: Record<SlotError, string> = {
  invalid_datetime: 'That date and time could not be read.',
  too_soon: `Please pick a time at least ${MIN_LEAD_MINUTES} minutes from now.`,
  too_far_ahead: `Please pick a time within the next ${MAX_DAYS_AHEAD} days.`,
  outside_business_days: 'Robin takes calls Monday to Friday.',
  outside_business_hours: `Calls run between ${BUSINESS_START_HOUR}:00 and ${BUSINESS_END_HOUR}:00 Manila time.`,
  not_on_grid: 'Slots start on the hour or the half hour.',
};

export function parseStart(startISO: string): Date | null {
  // Require an explicit offset or Z so "3pm" can never be read in server-local time.
  if (!/(?:Z|[+-]\d{2}:?\d{2})$/.test(startISO.trim())) return null;
  const date = new Date(startISO);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function validateSlot(
  startISO: string,
  durationMinutes: number,
  now: Date = new Date()
): SlotCheck {
  const fail = (code: SlotError): SlotCheck => ({ ok: false, code, message: SLOT_MESSAGES[code] });

  const start = parseStart(startISO);
  if (!start) return fail('invalid_datetime');

  const end = new Date(start.getTime() + durationMinutes * 60_000);

  if (start.getTime() < now.getTime() + MIN_LEAD_MINUTES * 60_000) return fail('too_soon');
  if (start.getTime() > now.getTime() + MAX_DAYS_AHEAD * 86_400_000) return fail('too_far_ahead');

  const parts = manilaParts(start);
  if (!BUSINESS_DAYS.includes(parts.weekday)) return fail('outside_business_days');
  if (parts.minute % SLOT_GRANULARITY_MINUTES !== 0) return fail('not_on_grid');

  const startMinutes = parts.minutesOfDay;
  if (
    startMinutes < BUSINESS_START_HOUR * 60 ||
    startMinutes + durationMinutes > BUSINESS_END_HOUR * 60
  ) {
    return fail('outside_business_hours');
  }

  return { ok: true, start, end };
}

/** Every bookable start time on a Manila calendar date, given what is taken. */
export function slotsForDate(
  dateKey: string,
  durationMinutes: number,
  now: Date = new Date(),
  taken: Array<{ start: Date; end: Date }> = []
): Array<{ startISO: string; label: string }> {
  const slots: Array<{ startISO: string; label: string }> = [];
  const lastStart = BUSINESS_END_HOUR * 60 - durationMinutes;

  for (let m = BUSINESS_START_HOUR * 60; m <= lastStart; m += SLOT_GRANULARITY_MINUTES) {
    const start = manilaWallClockToDate(dateKey, Math.floor(m / 60), m % 60);
    if (!start) break;

    if (!validateSlot(start.toISOString(), durationMinutes, now).ok) continue;

    const end = new Date(start.getTime() + durationMinutes * 60_000);
    const clash = taken.some((b) => start < b.end && end > b.start);
    if (clash) continue;

    slots.push({
      startISO: start.toISOString(),
      label: new Intl.DateTimeFormat('en-US', {
        timeZone: MANILA_TZ,
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }).format(start),
    });
  }

  return slots;
}

/**
 * Speech-to-text writes email addresses as prose ("robin at gmail dot com").
 * Recover the obvious cases so a booking is not lost to a transcription quirk.
 */
export function normalizeSpokenEmail(raw: string): string {
  const value = raw.trim().toLowerCase();
  if (value.includes('@') && !/\s/.test(value)) return value;

  return value
    .replace(/\s*\b(?:at|@)\b\s*/g, '@')
    .replace(/\s*\b(?:dot|period|point)\b\s*/g, '.')
    .replace(/\s*\b(?:dash|hyphen|minus)\b\s*/g, '-')
    .replace(/\s*\b(?:underscore|under\s?score)\b\s*/g, '_')
    .replace(/\s*\bplus\b\s*/g, '+')
    .replace(/\s+/g, '')
    .replace(/[.,;:!?]+$/, '');
}
