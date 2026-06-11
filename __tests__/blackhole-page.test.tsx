import { describe, it, expect, beforeAll } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import BlackHolePage, { metadata } from '../app/blackhole/page';
import BlackHoleBackground from '../app/blackhole/BlackHoleBackground';

describe('/blackhole route metadata', () => {
  it('exports a title and description', () => {
    expect(metadata.title).toBe('Black Hole');
    expect(metadata.description).toMatch(/black hole/i);
  });
});

describe('BlackHolePage', () => {
  let html: string;
  beforeAll(() => {
    html = renderToStaticMarkup(<BlackHolePage />);
  });

  it('renders the headline', () => {
    expect(html).toContain('rendered live in your browser');
  });

  it('links back to the profile root', () => {
    expect(html).toMatch(/<a[^>]*href="\/"/);
    expect(html).toContain('Back to profile');
  });

  it('embeds the black hole background canvas', () => {
    expect(html).toContain('<canvas');
  });

  // regression: a -z-10 canvas inside a bg-black main paints BEHIND the
  // background (no stacking context) — the page shipped as solid black.
  // The canvas must sit at z-0 with the content layered above it at z-10.
  it('layers the canvas above the background and below the content', () => {
    const canvasClass = html.match(/<canvas[^>]*class="([^"]*)"/)?.[1] ?? '';
    expect(canvasClass).toMatch(/\bz-0\b/);
    expect(canvasClass).not.toMatch(/-z-\d/);
    // z-10 is inert without a position — the wrapper must also be relative
    const wrapperClass =
      html.match(/<div[^>]*class="([^"]*\bz-10\b[^"]*)"/)?.[1] ?? '';
    expect(wrapperClass).toMatch(/\brelative\b/);
  });
});

describe('BlackHoleBackground (server render)', () => {
  let html: string;
  beforeAll(() => {
    html = renderToStaticMarkup(<BlackHoleBackground />);
  });

  it('renders a fullscreen canvas hidden from assistive tech', () => {
    expect(html).toMatch(/<canvas[^>]*aria-hidden="true"/);
    const canvasClass = html.match(/<canvas[^>]*class="([^"]*)"/)?.[1] ?? '';
    for (const cls of ['fixed', 'inset-0', 'pointer-events-none']) {
      expect(canvasClass).toContain(cls);
    }
  });
});
