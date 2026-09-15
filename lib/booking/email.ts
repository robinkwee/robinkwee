/**
 * Booking emails.
 *
 * Every interpolated value here came from an anonymous caller and lands in
 * Robin's inbox, so all of it is HTML-escaped. Each message also carries a
 * plain-text alternative — text/html-only mail scores badly with spam filters
 * and is unreadable in text clients.
 */

const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => HTML_ENTITIES[c]);
}

/** Only render a link we know is a safe absolute http(s) URL. */
export function safeUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export interface BookingEmailData {
  name: string;
  email: string;
  topic: string;
  whenManila: string;
  durationMinutes: number;
  meetLink: string | null;
  /** Shown when there is no meeting link yet. */
  fallbackNote: string;
  bookingRef: string;
}

const SHELL_OPEN =
  '<div style="font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;' +
  'max-width:560px;margin:0 auto;padding:24px;color:#111;">';
const SHELL_CLOSE = '</div>';

function joinBlock(meetLink: string | null, fallbackNote: string): string {
  if (meetLink) {
    const href = escapeHtml(meetLink);
    return `<p style="margin:0 0 6px;"><strong>Join:</strong> <a href="${href}">${href}</a></p>`;
  }
  return `<p style="margin:0 0 6px;color:#555;">${escapeHtml(fallbackNote)}</p>`;
}

export function confirmationHtml(d: BookingEmailData): string {
  return (
    SHELL_OPEN +
    `<h2 style="margin:0 0 8px;font-weight:600;">Your call with Robin is booked</h2>` +
    `<p style="margin:0 0 16px;color:#555;">${escapeHtml(d.whenManila)} · ${d.durationMinutes} minutes</p>` +
    `<div style="background:#f6f6f6;border-radius:10px;padding:14px 16px;margin:16px 0;">` +
    `<p style="margin:0 0 6px;"><strong>Name:</strong> ${escapeHtml(d.name)}</p>` +
    `<p style="margin:0 0 6px;"><strong>Email:</strong> ${escapeHtml(d.email)}</p>` +
    `<p style="margin:0 0 6px;"><strong>Topic:</strong> ${escapeHtml(d.topic)}</p>` +
    joinBlock(d.meetLink, d.fallbackNote) +
    `<p style="margin:0;color:#777;font-size:13px;">A calendar invite (.ics) is attached. ` +
    `You'll get a reminder 30 minutes before the call.</p>` +
    `</div>` +
    `<p style="margin:0 0 4px;color:#999;font-size:12px;">Need to change or cancel? Reply to this email.</p>` +
    `<p style="margin:0;color:#999;font-size:12px;">Ref ${escapeHtml(d.bookingRef)} · booked via robinkwee.com/call</p>` +
    SHELL_CLOSE
  );
}

export function confirmationText(d: BookingEmailData): string {
  return [
    'Your call with Robin is booked',
    '',
    `When:  ${d.whenManila} (${d.durationMinutes} minutes)`,
    `Name:  ${d.name}`,
    `Email: ${d.email}`,
    `Topic: ${d.topic}`,
    d.meetLink ? `Join:  ${d.meetLink}` : d.fallbackNote,
    '',
    "A calendar invite (.ics) is attached. You'll get a reminder 30 minutes before the call.",
    'Need to change or cancel? Reply to this email.',
    '',
    `Ref ${d.bookingRef} · booked via robinkwee.com/call`,
  ].join('\n');
}

export function reminderHtml(d: BookingEmailData): string {
  const link = d.meetLink ? escapeHtml(d.meetLink) : null;
  return (
    SHELL_OPEN +
    `<h2 style="margin:0 0 12px;">Your call with Robin starts in 30 minutes</h2>` +
    `<p style="margin:0 0 6px;"><strong>When:</strong> ${escapeHtml(d.whenManila)}</p>` +
    `<p style="margin:0 0 6px;"><strong>Topic:</strong> ${escapeHtml(d.topic)}</p>` +
    (link
      ? `<p style="margin:16px 0;"><a href="${link}" style="background:#10b981;color:#ffffff;` +
        `padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block;">Join the call</a></p>` +
        `<p style="margin:0;color:#888;font-size:13px;">${link}</p>`
      : `<p style="margin:16px 0;color:#555;">${escapeHtml(d.fallbackNote)}</p>`) +
    SHELL_CLOSE
  );
}

export function reminderText(d: BookingEmailData): string {
  return [
    'Your call with Robin starts in 30 minutes',
    '',
    `When:  ${d.whenManila}`,
    `Topic: ${d.topic}`,
    d.meetLink ? `Join:  ${d.meetLink}` : d.fallbackNote,
  ].join('\n');
}
