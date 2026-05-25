import 'server-only';
import { Resend } from 'resend';

type BookingInput = {
  name: string;
  email: string;
  startISO: string;       // ISO 8601 UTC, e.g. '2026-05-28T06:00:00Z'
  durationMinutes: number;
  topic: string;
};

type BookingResult =
  | { ok: true; meetLink: string; whenManila: string }
  | { ok: false; error: string };

const ROBIN_EMAIL = process.env.BOOKING_NOTIFY_EMAIL || 'robinkwee@gmail.com';
const FROM_EMAIL = process.env.BOOKING_FROM_EMAIL || 'onboarding@resend.dev'; // sandbox default
const MEET_LINK = process.env.MEET_LINK || 'https://meet.google.com/new';

function pad(n: number) { return String(n).padStart(2, '0'); }

function toIcsTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

function buildIcs({ name, email, startISO, durationMinutes, topic, meetLink }: BookingInput & { meetLink: string }): string {
  const start = new Date(startISO);
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  const uid = `${start.getTime()}-${email.replace(/[^a-z0-9]/gi, '')}@robinkwee.com`;

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//robinkwee.com//Aria Booking//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${toIcsTime(new Date().toISOString())}`,
    `DTSTART:${toIcsTime(start.toISOString())}`,
    `DTEND:${toIcsTime(end.toISOString())}`,
    `SUMMARY:Call with Robin Kwee — ${topic.replace(/[\r\n,]/g, ' ').slice(0, 80)}`,
    `DESCRIPTION:Topic: ${topic}\\n\\nJoin via Google Meet: ${meetLink}\\n\\nBooked via robinkwee.com/call`,
    `LOCATION:${meetLink}`,
    `ORGANIZER;CN=Robin Kwee:mailto:${ROBIN_EMAIL}`,
    `ATTENDEE;CN=${name};RSVP=TRUE:mailto:${email}`,
    `ATTENDEE;CN=Robin Kwee;RSVP=TRUE:mailto:${ROBIN_EMAIL}`,
    'STATUS:CONFIRMED',
    'BEGIN:VALARM',
    'TRIGGER:-PT30M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Reminder: call with Robin in 30 minutes',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

function formatManilaTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    timeZone: 'Asia/Manila',
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  }) + ' (Manila time)';
}

export async function bookCall(input: BookingInput): Promise<BookingResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: 'RESEND_API_KEY not configured' };

  const start = new Date(input.startISO);
  if (isNaN(start.getTime())) return { ok: false, error: 'Invalid datetime' };
  if (start.getTime() < Date.now() + 5 * 60_000) {
    return { ok: false, error: 'Time must be at least 5 minutes from now' };
  }

  const meetLink = MEET_LINK;
  const ics = buildIcs({ ...input, meetLink });
  const icsBase64 = Buffer.from(ics, 'utf-8').toString('base64');
  const whenManila = formatManilaTime(input.startISO);
  const reminderAt = new Date(start.getTime() - 30 * 60_000).toISOString();

  const resend = new Resend(apiKey);

  // 1. Immediate confirmation to caller + Robin
  const confirmHtml = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111;">
      <h2 style="margin:0 0 8px;font-weight:600;">Your call with Robin is booked</h2>
      <p style="margin:0 0 16px;color:#555;">${whenManila} · ${input.durationMinutes} minutes</p>
      <div style="background:#f6f6f6;border-radius:10px;padding:14px 16px;margin:16px 0;">
        <p style="margin:0 0 6px;"><strong>Topic:</strong> ${input.topic}</p>
        <p style="margin:0 0 6px;"><strong>Join:</strong> <a href="${meetLink}">${meetLink}</a></p>
        <p style="margin:0;color:#777;font-size:13px;">A calendar invite (.ics) is attached. You'll get a reminder 30 minutes before the call.</p>
      </div>
      <p style="margin:0;color:#999;font-size:12px;">Booked via robinkwee.com/call</p>
    </div>`;

  try {
    const { error: confirmErr } = await resend.emails.send({
      from: `Robin Kwee <${FROM_EMAIL}>`,
      to: [input.email],
      cc: [ROBIN_EMAIL],
      subject: `Call with Robin — ${whenManila}`,
      html: confirmHtml,
      attachments: [{ filename: 'invite.ics', content: icsBase64 }],
    });
    if (confirmErr) {
      console.error('Confirm email failed:', confirmErr);
      return { ok: false, error: 'Failed to send confirmation email' };
    }
  } catch (err) {
    console.error('Confirm email threw:', err);
    return { ok: false, error: 'Email service error' };
  }

  // 2. Scheduled reminder 30 min before — Resend handles delivery timing
  try {
    const reminderHtml = `
      <div style="font-family:-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111;">
        <h2 style="margin:0 0 12px;">Your call with Robin starts in 30 minutes</h2>
        <p style="margin:0 0 6px;"><strong>When:</strong> ${whenManila}</p>
        <p style="margin:0 0 6px;"><strong>Topic:</strong> ${input.topic}</p>
        <p style="margin:16px 0;"><a href="${meetLink}" style="background:#10b981;color:white;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block;">Join the call</a></p>
        <p style="margin:0;color:#888;font-size:13px;">${meetLink}</p>
      </div>`;
    await resend.emails.send({
      from: `Robin Kwee <${FROM_EMAIL}>`,
      to: [input.email],
      subject: `Reminder: call with Robin in 30 min`,
      html: reminderHtml,
      scheduledAt: reminderAt,
    });
  } catch (err) {
    // Don't fail the whole booking if reminder scheduling fails — confirmation already sent
    console.warn('Reminder scheduling failed (booking still confirmed):', err);
  }

  return { ok: true, meetLink, whenManila };
}
