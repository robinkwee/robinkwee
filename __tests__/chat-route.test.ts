import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock 'server-only' so it doesn't throw in test environment
vi.mock('server-only', () => ({}));

// Mock @ai-sdk/openai
vi.mock('@ai-sdk/openai', () => ({
  openai: vi.fn(() => 'mock-model'),
}));

// Mock the streamText function from 'ai' (v4 API)
vi.mock('ai', () => ({
  streamText: vi.fn(() => ({
    toDataStreamResponse: () =>
      new Response('0:"Hello"\n', {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      }),
  })),
}));

const { POST } = await import('../app/api/chat/route');

describe('POST /api/chat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 and a streaming response for a valid message', async () => {
    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Who are you?' }],
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it('returns 400 for a missing messages field', async () => {
    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it('returns 400 for an empty messages array', async () => {
    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [] }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid JSON body', async () => {
    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('trims to last 6 messages before calling streamText', async () => {
    const { streamText } = await import('ai');

    const manyMessages = Array.from({ length: 10 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `Message ${i}`,
    }));

    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: manyMessages }),
    });

    await POST(req);

    expect(streamText).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: manyMessages.slice(-6),
      })
    );
  });
});
