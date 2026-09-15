import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

const send = vi.fn();
vi.mock('resend', () => ({
  // `new Resend(key)` — must be constructable, so a plain arrow will not do.
  Resend: class {
    emails = { send };
  },
}));

// No Supabase env in tests, so the store uses its in-memory fallback.
const { bookCall, resolveMeetLink } = await import('../lib/booking');
const { __resetMemoryStore } = await import('../lib/booking/store');

/** Wednesday 2026-09-16, 10:00 Manila. */
const WED_10AM = '2026-09-16T02:00:00.000Z';
const NOW = new Date('2026-09-15T02:00:00.000Z');

const input = {
  name: 'Jane Smith',
  email: 'jane@example.com',
  topic: 'Padel partnership',
  startISO: WED_10AM,
  durationMinutes: 30,
};

/** The confirmation is always the first send; the reminder is the second. */
function confirmationSend() {
  return send.mock.calls[0][0] as Record<string, never> & {
    to: string[];
    cc?: string[];
    html: string;
    text: string;
    subject: string;
    attachments?: Array<{ filename: string; content: string; contentType?: string }>;
    scheduledAt?: string;
  };
}

function attachedIcs() {
  const attachment = confirmationSend().attachments![0];
  return Buffer.from(attachment.content, 'base64').toString('utf-8');
}

beforeEach(() => {
  send.mockReset();
  send.mockResolvedValue({ data: { id: 'msg_1' }, error: null });
  __resetMemoryStore();
  process.env.RESEND_API_KEY = 'test-key';
  delete process.env.MEET_LINK;
});

describe('resolveMeetLink', () => {
  it('refuses the "new meeting" URL, which opens a different room per click', () => {
    expect(resolveMeetLink('https://meet.google.com/new')).toBeNull();
    expect(resolveMeetLink('https://meet.google.com/NEW')).toBeNull();
  });

  it('accepts a real, stable room', () => {
    expect(resolveMeetLink('https://meet.google.com/abc-defg-hij')).toBe(
      'https://meet.google.com/abc-defg-hij'
    );
  });

  it('refuses anything that is not an http(s) URL', () => {
    expect(resolveMeetLink('javascript:alert(1)')).toBeNull();
    expect(resolveMeetLink('not a url')).toBeNull();
    expect(resolveMeetLink(undefined)).toBeNull();
  });
});

describe('bookCall', () => {
  it('books a valid slot and sends a confirmation with an .ics attachment', async () => {
    const result = await bookCall(input, { now: NOW });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.whenManila).toContain('10:00 AM');
    expect(result.whenManila).toContain('Manila time');
    expect(result.bookingRef).toMatch(/^[A-Z0-9]{6}$/);

    const confirmation = send.mock.calls[0][0];
    expect(confirmation.to).toEqual(['jane@example.com']);
    expect(confirmation.cc).toEqual(['robinkwee@gmail.com']);
    expect(confirmation.attachments?.[0].filename).toBe('invite.ics');
    expect(confirmation.attachments?.[0].contentType).toContain('text/calendar');
    expect(confirmation.attachments?.[0].contentType).toContain('method=REQUEST');
    // Plain-text alternative, so the mail is readable and scores better.
    expect(confirmation.text).toContain('Padel partnership');
  });

  it('schedules a reminder 30 minutes before the call', async () => {
    await bookCall(input, { now: NOW });
    const reminder = send.mock.calls[1][0];
    expect(reminder.scheduledAt).toBe('2026-09-16T01:30:00.000Z');
  });

  it('never schedules a reminder in the past, even at the minimum lead time', async () => {
    // Resend rejects a past `scheduledAt`. Booking 09:00 Manila at 08:00 Manila
    // is the tightest slot the lead time allows, so if the reminder can ever
    // land in the past it happens here — which is what would break if the lead
    // time were ever dropped below the reminder offset.
    const justInTime = new Date('2026-09-16T00:00:00.000Z');
    const result = await bookCall(
      { ...input, startISO: '2026-09-16T01:00:00.000Z' },
      { now: justInTime }
    );

    expect(result.ok).toBe(true);
    const reminder = send.mock.calls[1][0];
    expect(new Date(reminder.scheduledAt).getTime()).toBeGreaterThan(justInTime.getTime());
  });

  it('rejects a slot outside business hours before sending anything', async () => {
    const result = await bookCall({ ...input, startISO: '2026-09-16T19:00:00.000Z' }, { now: NOW });
    expect(result).toMatchObject({ ok: false, code: 'invalid_slot' });
    expect(send).not.toHaveBeenCalled();
  });

  it('reports field errors for bad input without sending anything', async () => {
    const result = await bookCall({ ...input, email: 'nope' }, { now: NOW });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('invalid_input');
    expect(result.fieldErrors?.email).toBeTruthy();
    expect(send).not.toHaveBeenCalled();
  });

  it('refuses a second booking that overlaps a confirmed one', async () => {
    expect((await bookCall(input, { now: NOW })).ok).toBe(true);

    const overlapping = await bookCall(
      { ...input, email: 'someone@else.com', startISO: WED_10AM },
      { now: NOW }
    );
    expect(overlapping).toMatchObject({ ok: false, code: 'slot_taken' });
    expect(send).toHaveBeenCalledTimes(2); // only the first booking's two mails
  });

  it('treats a repeat of the same booking as a duplicate, not a second invite', async () => {
    await bookCall(input, { now: NOW });
    const again = await bookCall(input, { now: NOW });
    expect(again).toMatchObject({ ok: false, code: 'already_booked' });
  });

  it('frees the slot again when the confirmation email fails', async () => {
    send.mockResolvedValueOnce({ data: null, error: { message: 'nope' } });

    const failed = await bookCall(input, { now: NOW });
    expect(failed).toMatchObject({ ok: false, code: 'email_failed' });

    // The slot must not stay locked by a booking nobody was told about.
    send.mockResolvedValue({ data: { id: 'msg_2' }, error: null });
    expect((await bookCall(input, { now: NOW })).ok).toBe(true);
  });

  it('fails with an actionable message when email is not configured', async () => {
    delete process.env.RESEND_API_KEY;
    const result = await bookCall(input, { now: NOW });
    expect(result).toMatchObject({ ok: false, code: 'email_not_configured' });
    if (result.ok) return;
    expect(result.error).toContain('robinkwee@gmail.com');
  });

  it('escapes caller-supplied text in the email instead of rendering it', async () => {
    await bookCall(
      { ...input, name: '<img src=x onerror=alert(1)>', topic: 'a & b <b>bold</b>' },
      { now: NOW }
    );
    const html = confirmationSend().html;
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x');
    expect(html).toContain('a &amp; b &lt;b&gt;bold&lt;/b&gt;');
  });

  it('escapes caller-supplied text in the calendar invite', async () => {
    await bookCall({ ...input, name: 'Smith, Jane', topic: 'Padel; courts' }, { now: NOW });
    const ics = attachedIcs();
    expect(ics).toContain('CN="Smith, Jane"');
    expect(ics).toContain('Padel\\; courts');
  });

  it('omits the meeting link entirely when none is configured', async () => {
    const result = await bookCall(input, { now: NOW });
    expect(result.ok && result.meetLink).toBeNull();
    expect(confirmationSend().text).toContain('Robin will email you the meeting link');
    expect(attachedIcs()).not.toContain('LOCATION:');
  });

  it('uses a configured meeting room when there is one', async () => {
    process.env.MEET_LINK = 'https://meet.google.com/abc-defg-hij';
    const result = await bookCall(input, { now: NOW });
    expect(result.ok && result.meetLink).toBe('https://meet.google.com/abc-defg-hij');
    expect(attachedIcs()).toContain('LOCATION:https://meet.google.com/abc-defg-hij');
  });
});
