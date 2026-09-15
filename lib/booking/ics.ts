/**
 * Minimal, spec-correct iCalendar (RFC 5545) writer.
 *
 * The previous version interpolated caller-supplied text straight into the
 * event. Unescaped commas, semicolons and newlines end a property early, so a
 * name like "Smith, Jane" produced an invite that Gmail and Outlook silently
 * refused to attach to the calendar — and a newline let a caller inject
 * arbitrary calendar properties.
 */

export interface IcsEvent {
  uid: string;
  start: Date;
  end: Date;
  summary: string;
  description: string;
  location?: string;
  organizer: { name: string; email: string };
  attendees: Array<{ name: string; email: string; rsvp?: boolean }>;
  /** Minutes before the start to fire the alarm. Omit for no alarm. */
  reminderMinutes?: number;
  sequence?: number;
  stamp?: Date;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** UTC timestamp in iCalendar basic format: 20260528T060000Z. */
export function toIcsUtc(date: Date): string {
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  );
}

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/** RFC 5545 §3.3.11 TEXT escaping. Order matters: backslash first. */
export function escapeIcsText(value: string): string {
  return value
    .replace(CONTROL_CHARS, '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/** A quoted parameter value; `"` is not escapable inside one, so drop it. */
function quoteParam(value: string): string {
  return `"${value.replace(CONTROL_CHARS, '').replace(/["^]/g, '')}"`;
}

/**
 * RFC 5545 §3.1 content lines are limited to 75 octets. Fold on octet count
 * (not characters) and never split a multi-byte sequence.
 */
export function foldIcsLine(line: string, limit = 75): string {
  const bytes = Buffer.from(line, 'utf-8');
  if (bytes.length <= limit) return line;

  const chunks: string[] = [];
  let offset = 0;
  let budget = limit;

  while (offset < bytes.length) {
    let take = Math.min(budget, bytes.length - offset);
    // Back off until the slice ends on a UTF-8 boundary.
    while (take > 0 && (bytes[offset + take] & 0b1100_0000) === 0b1000_0000) take--;
    if (take === 0) take = Math.min(budget, bytes.length - offset);

    chunks.push(bytes.subarray(offset, offset + take).toString('utf-8'));
    offset += take;
    budget = limit - 1; // continuation lines start with a leading space
  }

  return chunks.join('\r\n ');
}

function sanitizeUri(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function buildIcs(event: IcsEvent): string {
  const stamp = event.stamp ?? new Date();
  const location = event.location ? sanitizeUri(event.location) : null;

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//robinkwee.com//Booking//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${escapeIcsText(event.uid)}`,
    `DTSTAMP:${toIcsUtc(stamp)}`,
    `DTSTART:${toIcsUtc(event.start)}`,
    `DTEND:${toIcsUtc(event.end)}`,
    `SEQUENCE:${event.sequence ?? 0}`,
    `SUMMARY:${escapeIcsText(event.summary)}`,
    `DESCRIPTION:${escapeIcsText(event.description)}`,
  ];

  if (location) lines.push(`LOCATION:${escapeIcsText(location)}`);
  lines.push(
    `ORGANIZER;CN=${quoteParam(event.organizer.name)}:mailto:${event.organizer.email}`
  );

  for (const attendee of event.attendees) {
    lines.push(
      `ATTENDEE;CN=${quoteParam(attendee.name)};ROLE=REQ-PARTICIPANT` +
        `;PARTSTAT=NEEDS-ACTION;RSVP=${attendee.rsvp === false ? 'FALSE' : 'TRUE'}` +
        `:mailto:${attendee.email}`
    );
  }

  lines.push('STATUS:CONFIRMED', 'TRANSP:OPAQUE');

  if (event.reminderMinutes && event.reminderMinutes > 0) {
    lines.push(
      'BEGIN:VALARM',
      `TRIGGER:-PT${Math.round(event.reminderMinutes)}M`,
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeIcsText(event.summary)}`,
      'END:VALARM'
    );
  }

  lines.push('END:VEVENT', 'END:VCALENDAR');

  return lines.map((line) => foldIcsLine(line)).join('\r\n') + '\r\n';
}
