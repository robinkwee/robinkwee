import { describe, it, expect } from 'vitest';
import { buildIcs, escapeIcsText, foldIcsLine, toIcsUtc } from '../lib/booking/ics';

const CRLF = '\r\n';

function unfold(ics: string): string[] {
  // Undo RFC 5545 folding so assertions can look at logical lines.
  return ics.replace(/\r\n /g, '').split(CRLF).filter(Boolean);
}

const baseEvent = {
  uid: 'abc-123@robinkwee.com',
  start: new Date('2026-09-16T02:00:00.000Z'),
  end: new Date('2026-09-16T02:30:00.000Z'),
  summary: 'Call with Robin Kwee — Padel',
  description: 'Topic: Padel\n\nBooked via robinkwee.com/call',
  organizer: { name: 'Robin Kwee', email: 'robinkwee@gmail.com' },
  attendees: [{ name: 'Jane Smith', email: 'jane@example.com' }],
  stamp: new Date('2026-09-15T08:00:00.000Z'),
};

describe('toIcsUtc', () => {
  it('writes the basic UTC format', () => {
    expect(toIcsUtc(new Date('2026-09-16T02:00:00.000Z'))).toBe('20260916T020000Z');
    expect(toIcsUtc(new Date('2026-01-05T09:07:03.000Z'))).toBe('20260105T090703Z');
  });
});

describe('escapeIcsText', () => {
  it('escapes the characters that end a property early', () => {
    expect(escapeIcsText('Smith, Jane')).toBe('Smith\\, Jane');
    expect(escapeIcsText('a;b')).toBe('a\\;b');
    expect(escapeIcsText('back\\slash')).toBe('back\\\\slash');
    expect(escapeIcsText('line1\nline2')).toBe('line1\\nline2');
    expect(escapeIcsText('line1\r\nline2')).toBe('line1\\nline2');
  });

  it('escapes the backslash before anything else', () => {
    // A naive order would turn "\," into "\\\," and corrupt the value.
    expect(escapeIcsText('a\\,b')).toBe('a\\\\\\,b');
  });
});

describe('foldIcsLine', () => {
  it('leaves short lines alone', () => {
    expect(foldIcsLine('SUMMARY:hello')).toBe('SUMMARY:hello');
  });

  it('folds long lines at 75 octets with a leading space', () => {
    const folded = foldIcsLine(`DESCRIPTION:${'x'.repeat(200)}`);
    for (const line of folded.split(CRLF)) {
      expect(Buffer.from(line, 'utf-8').length).toBeLessThanOrEqual(75);
    }
    expect(folded.split(CRLF).slice(1).every((l) => l.startsWith(' '))).toBe(true);
    expect(folded.replace(/\r\n /g, '')).toBe(`DESCRIPTION:${'x'.repeat(200)}`);
  });

  it('never splits a multi-byte character', () => {
    const folded = foldIcsLine(`SUMMARY:${'é'.repeat(80)}`);
    // A split inside a UTF-8 sequence would surface as a replacement char.
    expect(folded).not.toContain('�');
    expect(folded.replace(/\r\n /g, '')).toBe(`SUMMARY:${'é'.repeat(80)}`);
  });
});

describe('buildIcs', () => {
  it('produces a well-formed VEVENT', () => {
    const lines = unfold(buildIcs(baseEvent));
    expect(lines[0]).toBe('BEGIN:VCALENDAR');
    expect(lines.at(-1)).toBe('END:VCALENDAR');
    expect(lines).toContain('METHOD:REQUEST');
    expect(lines).toContain('DTSTART:20260916T020000Z');
    expect(lines).toContain('DTEND:20260916T023000Z');
    expect(lines).toContain('DTSTAMP:20260915T080000Z');
    expect(lines).toContain('UID:abc-123@robinkwee.com');
    expect(lines).toContain('STATUS:CONFIRMED');
    expect(lines).toContain('SEQUENCE:0');
  });

  it('ends every line with CRLF, as the spec requires', () => {
    const ics = buildIcs(baseEvent);
    expect(ics.endsWith(CRLF)).toBe(true);
    expect(ics.split('\n').every((l) => l === '' || l.endsWith('\r'))).toBe(true);
  });

  it('quotes attendee names so a comma cannot truncate the property', () => {
    const lines = unfold(buildIcs({ ...baseEvent, attendees: [{ name: 'Smith, Jane', email: 'j@x.com' }] }));
    const attendee = lines.find((l) => l.startsWith('ATTENDEE'))!;
    expect(attendee).toContain('CN="Smith, Jane"');
    expect(attendee).toContain('mailto:j@x.com');
  });

  it('cannot be used to inject extra calendar properties', () => {
    const hostile = 'Padel\r\nATTENDEE;CN=Evil:mailto:evil@example.com\r\nX-EVIL:1';
    const lines = unfold(buildIcs({ ...baseEvent, summary: hostile, description: hostile }));

    expect(lines.some((l) => l.startsWith('X-EVIL'))).toBe(false);
    expect(lines.filter((l) => l.startsWith('ATTENDEE'))).toHaveLength(1);
    expect(lines.find((l) => l.startsWith('SUMMARY'))).toContain('\\n');
  });

  it('strips a quote from a CN rather than letting it close the parameter', () => {
    const lines = unfold(
      buildIcs({ ...baseEvent, attendees: [{ name: 'A" ;ROLE=CHAIR;X="', email: 'a@x.com' }] })
    );
    const attendee = lines.find((l) => l.startsWith('ATTENDEE'))!;

    // A quoted parameter value may legally contain ";" — what matters is that
    // the caller's own quotes are gone, so the value cannot close early and
    // have the rest read as real parameters.
    expect(attendee.match(/"/g)).toHaveLength(2);
    const [, cn, rest] = /^ATTENDEE;CN="([^"]*)"(.*)$/.exec(attendee)!;
    expect(cn).toBe('A ;ROLE=CHAIR;X=');
    expect(rest).toBe(';ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:a@x.com');
  });

  it('includes a location only for a safe http(s) URL', () => {
    const withMeet = unfold(buildIcs({ ...baseEvent, location: 'https://meet.google.com/abc-defg-hij' }));
    expect(withMeet).toContain('LOCATION:https://meet.google.com/abc-defg-hij');

    const withScript = unfold(buildIcs({ ...baseEvent, location: 'javascript:alert(1)' }));
    expect(withScript.some((l) => l.startsWith('LOCATION'))).toBe(false);
  });

  it('adds an alarm only when one is asked for', () => {
    expect(unfold(buildIcs(baseEvent)).some((l) => l === 'BEGIN:VALARM')).toBe(false);
    const withAlarm = unfold(buildIcs({ ...baseEvent, reminderMinutes: 30 }));
    expect(withAlarm).toContain('BEGIN:VALARM');
    expect(withAlarm).toContain('TRIGGER:-PT30M');
  });
});
