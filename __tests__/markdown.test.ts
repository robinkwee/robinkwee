import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

// Mock fs and path — we inject fake filesystem state per test
vi.mock('fs');
vi.mock('path', () => ({
  default: {
    join: (...parts: string[]) => parts.join('/'),
  },
}));

import fs from 'fs';

const mockFs = fs as unknown as {
  existsSync: ReturnType<typeof vi.fn>;
  readdirSync: ReturnType<typeof vi.fn>;
  readFileSync: ReturnType<typeof vi.fn>;
};

function makeFrontmatter(fields: Record<string, unknown>, body = 'Hello world') {
  const yaml = Object.entries(fields)
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join('\n');
  return `---\n${yaml}\n---\n${body}`;
}

describe('getPostMeta()', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns posts sorted newest first', async () => {
    mockFs.existsSync = vi.fn(() => true);
    mockFs.readdirSync = vi.fn(() => [
      '2026-01-01-older.md',
      '2026-06-01-newer.md',
    ] as unknown as fs.Dirent[]);
    mockFs.readFileSync = vi.fn((p: string) => {
      if (String(p).includes('older')) {
        return makeFrontmatter({ title: 'Older Post', date: '2026-01-01', published: true, tags: [], excerpt: '' });
      }
      return makeFrontmatter({ title: 'Newer Post', date: '2026-06-01', published: true, tags: [], excerpt: '' });
    }) as unknown as typeof fs.readFileSync;

    const { getPostMeta } = await import('../lib/markdown');
    const posts = getPostMeta();
    expect(posts[0].slug).toBe('newer');
    expect(posts[1].slug).toBe('older');
  });

  it('hides posts where published is undefined', async () => {
    mockFs.existsSync = vi.fn(() => true);
    mockFs.readdirSync = vi.fn(() => ['2026-01-01-draft.md'] as unknown as fs.Dirent[]);
    mockFs.readFileSync = vi.fn(() =>
      makeFrontmatter({ title: 'Draft', date: '2026-01-01', tags: [], excerpt: '' })
    ) as unknown as typeof fs.readFileSync;

    const { getPostMeta } = await import('../lib/markdown');
    expect(getPostMeta()).toHaveLength(0);
  });

  it('hides posts where published is false', async () => {
    mockFs.existsSync = vi.fn(() => true);
    mockFs.readdirSync = vi.fn(() => ['2026-01-01-hidden.md'] as unknown as fs.Dirent[]);
    mockFs.readFileSync = vi.fn(() =>
      makeFrontmatter({ title: 'Hidden', date: '2026-01-01', published: false, tags: [], excerpt: '' })
    ) as unknown as typeof fs.readFileSync;

    const { getPostMeta } = await import('../lib/markdown');
    expect(getPostMeta()).toHaveLength(0);
  });

  it('returns empty array when content dir does not exist', async () => {
    mockFs.existsSync = vi.fn(() => false);

    const { getPostMeta } = await import('../lib/markdown');
    expect(getPostMeta()).toEqual([]);
  });

  it('throws on duplicate slugs', async () => {
    mockFs.existsSync = vi.fn(() => true);
    mockFs.readdirSync = vi.fn(() => [
      '2026-01-01-hello.md',
      '2026-06-01-hello.md',
    ] as unknown as fs.Dirent[]);
    mockFs.readFileSync = vi.fn(() =>
      makeFrontmatter({ title: 'Hello', date: '2026-01-01', published: true, tags: [], excerpt: '' })
    ) as unknown as typeof fs.readFileSync;

    const { getPostMeta } = await import('../lib/markdown');
    expect(() => getPostMeta()).toThrow(/Duplicate blog slug/);
  });
});

describe('getPostContent()', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns HTML string for a valid published slug', async () => {
    mockFs.existsSync = vi.fn(() => true);
    mockFs.readdirSync = vi.fn(() => ['2026-05-26-building-padel.md'] as unknown as fs.Dirent[]);
    mockFs.readFileSync = vi.fn(() =>
      makeFrontmatter(
        { title: 'Building Padel', date: '2026-05-26', published: true, tags: [], excerpt: '' },
        '## Hello\n\nSome content.'
      )
    ) as unknown as typeof fs.readFileSync;

    const { getPostContent } = await import('../lib/markdown');
    const html = await getPostContent('building-padel');
    expect(typeof html).toBe('string');
    expect(html).toContain('<h2');
    expect(html).toContain('Hello');
  });

  it('returns undefined for an unknown slug', async () => {
    mockFs.existsSync = vi.fn(() => true);
    mockFs.readdirSync = vi.fn(() => [] as unknown as fs.Dirent[]);

    const { getPostContent } = await import('../lib/markdown');
    const result = await getPostContent('not-a-real-slug');
    expect(result).toBeUndefined();
  });
});
