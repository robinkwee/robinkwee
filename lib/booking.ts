import 'server-only';
import { randomUUID } from 'crypto';
import { Resend } from 'resend';
import {
  bookingInputSchema,
  formatManilaWithZone,
  validateSlot,
  type BookingInput,
} from './booking/schema';
import { buildIcs } from './booking/ics';
import {
  confirmationHtml,
  confirmationText,
  reminderHtml,
  reminderText,
  safeUrl,
  type BookingEmailData,
} from './booking/email';
import { isPersistent, release, reserve, type BookingSource } from './booking/store';

export type BookingErrorCode =
  | 'invalid_input'
  | 'invalid_slot'
  | 'slot_taken'
  | 'already_booked'
  | 'email_not_configured'
  | 'email_failed';

export type BookingResult =
  | {
      ok: true;
      bookingRef: string;
      meetLink: string | null;
      whenManila: string;
      startISO: string;
      durationMinutes: number;
      /** False when the booking could not be written to durable storage. */
      persisted: boolean;
    }
  | { ok: false; code: BookingErrorCode; error: string; fieldErrors?: Record<string, string> };

const ROBIN_EMAIL = process.env.BOOKING_NOTIFY_EMAIL || 'robinkwee@gmail.com';
const FROM_EMAIL = process.env.BOOKING_FROM_EMAIL || 'onboarding@resend.dev';
const REMINDER_MINUTES = 30;
/** Resend rejects a schedule in the past; leave room for clock skew. */
const MIN_REMINDER_LEAD_MS = 2 * 60_000;

const FALLBACK_NOTE =
  'Robin will email you the meeting link before the call. Reply to this email if you would rather use WhatsApp.';

/**
 * The meeting link.
 *
 * `https://meet.google.com/new` was the old default, and it is not a room —
 * every person who opens it creates their own new meeting, so Robin and the
 * caller reliably ended up in two different calls. Only a configured, stable
 * room is used; otherwise the invite promises a link instead of shipping a
 * broken one.
 */
export function resolveMeetLink(raw = process.env.MEET_LINK): string | null {
  const url = safeUrl(raw);
  if (!url) return null;
  if (/meet\.google\.com\/(new|_meet)\b/i.test(url)) {
    console.warn('[booking] MEET_LINK points at "new meeting" and creates a fresh room per click; ignoring.');
    return null;
  }
  return url;
}

/** Short, human-quotable reference for support ("Ref 7QK4M2"). */
function bookingRefFrom(id: string): string {
  return id.replace(/[^a-z0-9]/gi, '').slice(0, 6).toUpperCase();
}

export interface BookCallOptions {
  now?: Date;
  source?: BookingSource;
}

export async function bookCall(
  raw: unknown,
  options: BookCallOptions = {}
): Promise<BookingResult> {
  const now = options.now ?? new Date();

  const parsed = bookingInputSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? 'form');
      fieldErrors[key] ??= issue.message;
    }
    return {
      ok: false,
      code: 'invalid_input',
      error: Object.values(fieldErrors)[0] ?? 'Those details are not valid.',
      fieldErrors,
    };
  }

  const input: BookingInput = parsed.data;

  const slot = validateSlot(input.startISO, input.durationMinutes, now);
  if (!slot.ok) {
    return { ok: false, code: 'invalid_slot', error: slot.message };
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('[booking] RESEND_API_KEY is not set — cannot confirm bookings.');
    return {
      ok: false,
      code: 'email_not_configured',
      error: `Booking is temporarily unavailable. Please email ${ROBIN_EMAIL} and Robin will set the call up directly.`,
    };
  }

  const id = randomUUID();
  const bookingRef = bookingRefFrom(id);
  const startISO = slot.start.toISOString();
  const endISO = slot.end.toISOString();

  // Claim the slot before sending anything, so two callers racing for the same
  // time cannot both receive a confirmation.
  const reservation = await reserve({
    id,
    name: input.name,
    email: input.email,
    topic: input.topic,
    start_at: startISO,
    end_at: endISO,
    duration_minutes: input.durationMinutes,
    status: 'confirmed',
    source: options.source ?? 'web',
    created_at: now.toISOString(),
  });

  if (!reservation.ok) {
    return reservation.reason === 'duplicate'
      ? {
          ok: false,
          code: 'already_booked',
          error: 'You already have that slot booked — check your inbox for the invite.',
        }
      : {
          ok: false,
          code: 'slot_taken',
          error: 'That slot was just taken. Please pick another time.',
        };
  }

  const meetLink = resolveMeetLink();
  const whenManila = formatManilaWithZone(slot.start);

  const emailData: BookingEmailData = {
    name: input.name,
    email: input.email,
    topic: input.topic,
    whenManila,
    durationMinutes: input.durationMinutes,
    meetLink,
    fallbackNote: FALLBACK_NOTE,
    bookingRef,
  };

  const ics = buildIcs({
    uid: `${id}@robinkwee.com`,
    start: slot.start,
    end: slot.end,
    summary: `Call with Robin Kwee — ${input.topic}`,
    description: [
      `Topic: ${input.topic}`,
      '',
      meetLink ? `Join via Google Meet: ${meetLink}` : FALLBACK_NOTE,
      '',
      `Booked via robinkwee.com/call (ref ${bookingRef})`,
    ].join('\n'),
    location: meetLink ?? undefined,
    organizer: { name: 'Robin Kwee', email: ROBIN_EMAIL },
    attendees: [
      { name: input.name, email: input.email },
      { name: 'Robin Kwee', email: ROBIN_EMAIL },
    ],
    reminderMinutes: REMINDER_MINUTES,
    stamp: now,
  });

  const resend = new Resend(apiKey);

  try {
    const { error } = await resend.emails.send({
      from: `Robin Kwee <${FROM_EMAIL}>`,
      to: [input.email],
      cc: [ROBIN_EMAIL],
      replyTo: [input.email, ROBIN_EMAIL],
      subject: `Call with Robin — ${whenManila}`,
      html: confirmationHtml(emailData),
      text: confirmationText(emailData),
      attachments: [
        {
          filename: 'invite.ics',
          content: Buffer.from(ics, 'utf-8').toString('base64'),
          contentType: 'text/calendar; charset=utf-8; method=REQUEST',
        },
      ],
    });

    if (error) throw new Error(error.message ?? 'send failed');
  } catch (err) {
    // The caller has no confirmation, so do not hold the slot.
    console.error('[booking] confirmation email failed:', err);
    await release(id);
    return {
      ok: false,
      code: 'email_failed',
      error: `We could not send your confirmation. Please email ${ROBIN_EMAIL} and Robin will set the call up directly.`,
    };
  }

  // Best effort from here: the booking is confirmed either way.
  const reminderAt = new Date(slot.start.getTime() - REMINDER_MINUTES * 60_000);
  if (reminderAt.getTime() > now.getTime() + MIN_REMINDER_LEAD_MS) {
    try {
      await resend.emails.send({
        from: `Robin Kwee <${FROM_EMAIL}>`,
        to: [input.email],
        replyTo: [ROBIN_EMAIL],
        subject: 'Reminder: call with Robin in 30 min',
        html: reminderHtml(emailData),
        text: reminderText(emailData),
        scheduledAt: reminderAt.toISOString(),
      });
    } catch (err) {
      console.warn('[booking] reminder scheduling failed (booking still confirmed):', err);
    }
  }

  if (!reservation.persisted) {
    console.warn(
      `[booking] ${bookingRef} was confirmed but not persisted${
        isPersistent() ? '' : ' (Supabase not configured)'
      } — double-booking protection is limited to this instance.`
    );
  }

  return {
    ok: true,
    bookingRef,
    meetLink,
    whenManila,
    startISO,
    durationMinutes: input.durationMinutes,
    persisted: reservation.persisted,
  };
}
