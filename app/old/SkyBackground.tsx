'use client';

import { useEffect, useRef } from 'react';

const TAU = Math.PI * 2;
const PALETTE: ReadonlyArray<readonly [number, number, number]> = [
  [185, 205, 255],
  [215, 225, 255],
  [245, 245, 250],
  [255, 244, 224],
  [255, 226, 168],
];

type Star = { rx: number; ry: number; r: number; base: number; ci: number; tw: number; ph: number; twAmt: number };
type Band = { rx: number; ry: number; r: number; base: number; ci: number };
type Haze = { rx: number; ry: number; rad: number };

export default function SkyBackground() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || typeof window === 'undefined') return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const omega = reduce ? 0 : 0.0042;

    let raf = 0;
    let last = 0;
    let stopped = false;
    let started = false;
    let visible = !document.hidden;
    let staticDrawn = false;
    let ctx: CanvasRenderingContext2D | null = null;
    let w = 0;
    let h = 0;
    let angle = 0;
    let pole = { x: 0, y: 0 };
    let stars: Star[] = [];
    let band: Band[] = [];
    let haze: Haze[] = [];
    let sprites: HTMLCanvasElement[] = [];
    let startTime = performance.now();

    const rnd = (a: number, b: number) => a + Math.random() * (b - a);
    const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

    const makeSprites = () => {
      sprites = PALETTE.map(([r, g, b]) => {
        const S = 32;
        const cv = document.createElement('canvas');
        cv.width = cv.height = S;
        const g2 = cv.getContext('2d')!;
        const grd = g2.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
        grd.addColorStop(0, `rgba(${r},${g},${b},1)`);
        grd.addColorStop(0.06, `rgba(${r},${g},${b},0.95)`);
        grd.addColorStop(0.18, `rgba(${r},${g},${b},0.32)`);
        grd.addColorStop(0.45, `rgba(${r},${g},${b},0.07)`);
        grd.addColorStop(1, `rgba(${r},${g},${b},0)`);
        g2.fillStyle = grd;
        g2.fillRect(0, 0, S, S);
        return cv;
      });
    };

    const computePole = (): { x: number; y: number } => {
      const anchor = document.querySelector('[data-north-star]') as HTMLElement | null;
      if (anchor) {
        const r = anchor.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          return { x: r.left + r.width / 2, y: r.top + r.height * 0.27 };
        }
      }
      return { x: w * 0.5, y: h * 0.12 };
    };

    const build = () => {
      pole = computePole();
      let cover = 0;
      const corners: Array<[number, number]> = [[0, 0], [w, 0], [0, h], [w, h]];
      for (const [cx, cy] of corners) {
        cover = Math.max(cover, Math.hypot(cx - pole.x, cy - pole.y));
      }
      cover += Math.max(w, h) * 0.15;

      const nField = clamp(Math.round((w * h) / 2500), 350, 1100);
      stars = [];
      for (let i = 0; i < nField; i++) {
        const r = cover * Math.sqrt(Math.random());
        const a = Math.random() * TAU;
        const depth = Math.random();
        const m = Math.pow(Math.random(), 2.6);
        const bright = m > 0.86;
        const ci = bright ? (Math.random() < 0.5 ? 4 : 3) : ((Math.random() * PALETTE.length) | 0);
        stars.push({
          rx: Math.cos(a) * r,
          ry: Math.sin(a) * r,
          r: 0.9 + m * (1.6 + depth * 14),
          base: clamp(0.14 + m * 0.92, 0, 1),
          ci,
          tw: rnd(0.18, 0.7),
          ph: rnd(0, TAU),
          twAmt: 0.12 + Math.random() * 0.3,
        });
      }

      const bandAng = rnd(0.4, 0.9);
      const dir = { x: Math.cos(bandAng), y: Math.sin(bandAng) };
      const perp = { x: -dir.y, y: dir.x };
      const cen = { x: w * 0.5, y: h * 0.5 };
      const L = cover * 1.1;
      const nBand = clamp(Math.round((w * h) / 4500), 200, 700);
      band = [];
      for (let i = 0; i < nBand; i++) {
        const along = rnd(-L, L);
        const gauss = (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
        const off = gauss * Math.min(w, h) * 0.16;
        const bx = cen.x + dir.x * along + perp.x * off;
        const by = cen.y + dir.y * along + perp.y * off;
        band.push({
          rx: bx - pole.x,
          ry: by - pole.y,
          r: rnd(0.7, 1.8),
          base: rnd(0.05, 0.2),
          ci: (Math.random() * PALETTE.length) | 0,
        });
      }

      haze = [];
      for (let i = -3; i <= 3; i++) {
        const along = i * cover * 0.32 + rnd(-40, 40);
        const px = cen.x + dir.x * along;
        const py = cen.y + dir.y * along;
        haze.push({
          rx: px - pole.x,
          ry: py - pole.y,
          rad: Math.min(w, h) * rnd(0.12, 0.22),
        });
      }
    };

    const fit = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx = canvas.getContext('2d');
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!sprites.length) makeSprites();
      build();
      staticDrawn = false;
    };

    const draw = (t: number) => {
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);
      const px = pole.x;
      const py = pole.y;

      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(angle);

      ctx.globalCompositeOperation = 'lighter';
      for (const blob of haze) {
        const g = ctx.createRadialGradient(blob.rx, blob.ry, 0, blob.rx, blob.ry, blob.rad);
        g.addColorStop(0, 'rgba(125,140,185,0.13)');
        g.addColorStop(0.5, 'rgba(95,105,155,0.05)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(blob.rx - blob.rad, blob.ry - blob.rad, blob.rad * 2, blob.rad * 2);
      }

      for (const s of band) {
        ctx.globalAlpha = s.base;
        ctx.drawImage(sprites[s.ci], s.rx - s.r, s.ry - s.r, s.r * 2, s.r * 2);
      }

      for (const s of stars) {
        const tw = 1 - s.twAmt + s.twAmt * (0.5 + 0.5 * Math.sin(t * s.tw + s.ph));
        const a = s.base * tw;
        const r = s.r * (0.9 + 0.1 * tw);
        ctx.globalAlpha = a > 1 ? 1 : a;
        ctx.drawImage(sprites[s.ci], s.rx - r, s.ry - r, r * 2, r * 2);
      }
      ctx.globalAlpha = 1;
      ctx.restore();
      ctx.globalCompositeOperation = 'source-over';
    };

    const frame = (now: number) => {
      if (stopped) return;
      raf = requestAnimationFrame(frame);
      if (!visible || !ctx) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (reduce) {
        if (staticDrawn) return;
        staticDrawn = true;
        draw(0);
        return;
      }
      angle += omega * dt;
      draw((now - startTime) / 1000);
    };

    const onVis = () => {
      visible = !document.hidden;
      last = performance.now();
    };

    let rzTimer: number | undefined;
    const onResize = () => {
      window.clearTimeout(rzTimer);
      rzTimer = window.setTimeout(fit, 150);
    };

    const start = () => {
      if (stopped || started) return;
      started = true;
      fit();
      startTime = performance.now();
      last = startTime;
      raf = requestAnimationFrame(frame);
    };

    const ric =
      (window as Window & {
        requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      }).requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 200));
    const idleHandle = ric(start, { timeout: 1500 });

    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('resize', onResize);

    if ('fonts' in document) {
      document.fonts.ready.then(() => {
        if (!stopped && started) fit();
      });
    }

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      const cic = (window as Window & { cancelIdleCallback?: (h: number) => void }).cancelIdleCallback;
      if (cic) cic(idleHandle as number);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('resize', onResize);
      window.clearTimeout(rzTimer);
    };
  }, []);

  return (
    <>
      <canvas
        ref={ref}
        aria-hidden="true"
        className="fixed inset-0 w-full h-full pointer-events-none z-0"
      />
      <div
        aria-hidden="true"
        className="fixed inset-0 pointer-events-none z-[1]"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 35%, rgba(4,6,12,0.6) 100%)',
        }}
      />
    </>
  );
}
