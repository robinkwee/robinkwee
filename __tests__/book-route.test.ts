import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

const send = vi.fn();
vi.mock('resend', () => ({
  Resend: class {
    emails = { send };
  },
}));

const { GET, POST } = await import('../app/api/book/route');
const { __resetMemoryStore } = await import('../lib/booking/store');
const { __resetRateLimits } = await import('../lib/rate-limit');
const { manilaToday, addDaysToDateKey, weekdayOfDateKey } = await import('../lib/manila');

/** A weekday comfortably inside the booking window. */
function nextWeekday(offset = 3): string {
  let key = addDaysToDateKey(manilaToday(), offset);
  while (weekdayOfDateKey(key) === 0 || weekdayOfDateKey(key) === 6) {
    key = addDaysToDateKey(key, 1);
  }
  return key;
}

function get(path: string, ip = '203.0.113.1') {
  return GET(new Request(`https://robinkwee.com${path}`, { headers: { 'x-real-ip': ip } }));
}

function post(body: unknown, ip = '203.0.113.1') {
  return POST(
    new Request('https://robinkwee.com/api/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-real-ip': ip },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    })
  );
}

async function firstSlot(date: string): Promise<string> {
  const data = await (await get(`/api/book?date=${date}`)).json();
  return data.slots[0].startISO;
}

beforeEach(() => {
  send.mockReset();
  send.mockResolvedValue({ data: { id: 'msg_1' }, error: null });
  __resetMemoryStore();
  __resetRateLimits();
  process.env.RESEND_API_KEY = 'test-key';
});

describe('GET /api/book', () => {
  it('returns slots for a weekday', async () => {
    const res = await get(`/api/book?date=${nextWeekday()}`);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.isBusinessDay).toBe(true);
    expect(data.slots.length).toBeGreaterThan(0);
    expect(data.slots[0]).toHaveProperty('startISO');
    expect(data.slots[0]).toHaveProperty('label');
  });

  it('rejects a malformed date', async () => {
    expect((await get('/api/book?date=not-a-date')).status).toBe(400);
    expect((await get('/api/book?date=2026-02-31')).status).toBe(400);
  });

  it('falls back to the default duration for an unsupported one', async () => {
    const data = await (await get(`/api/book?date=${nextWeekday()}&duration=7`)).json();
    expect(data.durationMinutes).toBe(30);
  });

  it('never caches a per-caller response', async () => {
    const res = await get(`/api/book?date=${nextWeekday()}`);
    expect(res.headers.get('Cache-Control')).toContain('no-store');
  });
});

describe('POST /api/book', () => {
  it('books a slot and reports it as created', async () => {
    const date = nextWeekday();
    const res = await post({
      name: 'Jane Smith',
      email: 'jane@example.com',
      topic: 'Padel partnership',
      startISO: await firstSlot(date),
    });

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.bookingRef).toMatch(/^[A-Z0-9]{6}$/);
    expect(send).toHaveBeenCalled();
  });

  it('removes a booked slot from availability', async () => {
    const date = nextWeekday();
    const startISO = await firstSlot(date);

    await post({ name: 'Jane Smith', email: 'jane@example.com', topic: 'Padel', startISO });

    const data = await (await get(`/api/book?date=${date}`)).json();
    expect(data.slots.map((s: { startISO: string }) => s.startISO)).not.toContain(startISO);
  });

  it('returns 409 when the slot is already taken', async () => {
    const startISO = await firstSlot(nextWeekday());
    await post({ name: 'Jane Smith', email: 'jane@example.com', topic: 'Padel', startISO });

    const res = await post({
      name: 'Other Person',
      email: 'other@example.com',
      topic: 'Logistics',
      startISO,
    });
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe('slot_taken');
  });

  it('returns 400 and field errors for bad input', async () => {
    const res = await post({ name: 'J', email: 'nope', topic: '', startISO: 'whenever' });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.fieldErrors.email).toBeTruthy();
    expect(data.fieldErrors.name).toBeTruthy();
  });

  it('returns 400 for an unparseable body', async () => {
    expect((await post('not json')).status).toBe(400);
  });

  it('does not spend the booking quota on validation failures', async () => {
    // Fumbling the form must never cost someone the ability to book. The old
    // single counter refused the 6th request of any kind, typos included.
    for (let i = 0; i < 10; i++) {
      const res = await post({ name: 'J', email: 'nope', topic: '', startISO: 'whenever' });
      expect(res.status).toBe(400);
    }

    const res = await post({
      name: 'Jane Smith',
      email: 'jane@example.com',
      topic: 'Padel partnership',
      startISO: await firstSlot(nextWeekday()),
    });
    expect(res.status).toBe(201);
  });

  it('caps how many calls one caller can actually book', async () => {
    const date = nextWeekday();
    const slots = (await (await get(`/api/book?date=${date}`)).json()).slots as Array<{
      startISO: string;
    }>;

    for (let i = 0; i < 5; i++) {
      const res = await post({
        name: 'Jane Smith',
        email: `jane+${i}@example.com`,
        topic: 'Padel',
        startISO: slots[i].startISO,
      });
      expect(res.status).toBe(201);
    }

    const blocked = await post({
      name: 'Jane Smith',
      email: 'jane+5@example.com',
      topic: 'Padel',
      startISO: slots[5].startISO,
    });
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('Retry-After')).toBeTruthy();
  });

  it('caps invitations sent to one address, even from different callers', async () => {
    // Otherwise the endpoint is a way to bomb a third party's inbox.
    const date = nextWeekday();
    const slots = (await (await get(`/api/book?date=${date}`)).json()).slots as Array<{
      startISO: string;
    }>;

    for (let i = 0; i < 3; i++) {
      const res = await post(
        { name: 'Someone', email: 'victim@example.com', topic: 'Padel', startISO: slots[i].startISO },
        `203.0.113.${10 + i}`
      );
      expect(res.status).toBe(201);
    }

    const blocked = await post(
      { name: 'Someone', email: 'victim@example.com', topic: 'Padel', startISO: slots[3].startISO },
      '203.0.113.99'
    );
    expect(blocked.status).toBe(429);
  });

  it('returns 503 with an alternative when email is not configured', async () => {
    delete process.env.RESEND_API_KEY;
    const res = await post({
      name: 'Jane Smith',
      email: 'jane@example.com',
      topic: 'Padel',
      startISO: await firstSlot(nextWeekday()),
    });
    expect(res.status).toBe(503);
    expect((await res.json()).error).toContain('robinkwee@gmail.com');
  });
});
