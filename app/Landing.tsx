'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

const ParticleScene = dynamic(() => import('./ParticleScene'), { ssr: false });

const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

const VENTURES = [
  {
    idx: '01',
    name: 'GENAIO',
    desc: 'The AI translation layer for Filipino business.',
    href: 'https://genaio.org',
    tag: 'AI',
  },
  {
    idx: '02',
    name: 'DigitalNuvo',
    desc: 'AI systems that run your practice.',
    href: 'https://digitalnuvo.com/',
    tag: 'AI × Ecom',
  },
  {
    idx: '03',
    name: 'PROSMASH',
    desc: 'Padel club · Makati & Alabang.',
    href: 'https://prosmash.ph/',
    tag: 'Padel',
  },
  {
    idx: '04',
    name: 'Padel League PH',
    desc: 'Community + competitive layer for padel in the Philippines.',
    href: 'https://padelph.com/',
    tag: 'Padel',
  },
];

const SOCIALS = [
  { label: 'WhatsApp', href: 'https://api.whatsapp.com/send?phone=639178482217' },
  { label: 'Instagram', href: 'https://instagram.com/robinkwee' },
  { label: 'LinkedIn', href: 'https://linkedin.com/in/robinkwee' },
  { label: 'Facebook', href: 'https://www.facebook.com/robinkwee' },
  { label: 'Email', href: 'mailto:robinkwee@gmail.com' },
];

const MARQUEE = ['Logistics', 'Sports', 'Health', 'Distribution', 'Ecommerce', 'Farming', 'Systems'];

function ManilaClock() {
  const [time, setTime] = useState('--:--:--');
  useEffect(() => {
    const fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Manila',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const update = () => setTime(fmt.format(new Date()));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);
  return <span suppressHydrationWarning>{time}</span>;
}

/** Decorative activity heatmap — seeded so SSR and client render identically. */
const HEATMAP_CELLS = (() => {
  let s = 20260612;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  return Array.from({ length: 182 }, () => {
    const r = rand();
    return r > 0.84 ? 3 : r > 0.58 ? 2 : r > 0.3 ? 1 : 0;
  });
})();

function Heatmap() {
  const cells = HEATMAP_CELLS;
  return (
    <div className="v2-heatmap" aria-hidden="true">
      {cells.map((l, i) => (
        <span key={i} className="v2-cell" data-l={l} />
      ))}
    </div>
  );
}

export default function Landing() {
  const rootRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef(0);

  useIsoLayoutEffect(() => {
    gsap.registerPlugin(ScrollTrigger, SplitText);
    const root = rootRef.current;
    if (!root) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const cleanups: Array<() => void> = [];

    const ctx = gsap.context(() => {
      const pre = root.querySelector('.v2-preloader');
      const counter = root.querySelector('.v2-preloader-count');

      if (reduce) {
        gsap.set(pre, { display: 'none' });
        return; // content is fully visible without animation
      }

      // particle morph driven by overall page scroll
      ScrollTrigger.create({
        trigger: root,
        start: 'top top',
        end: 'bottom bottom',
        onUpdate: (self) => {
          progressRef.current = self.progress * 3;
        },
      });

      document.documentElement.classList.add('v2-lock');

      // intro: counter → curtain → hero type
      const nameSplits = Array.from(root.querySelectorAll('.v2-hero-name > span')).map(
        (el) => new SplitText(el, { type: 'chars', mask: 'chars' })
      );
      const chars = nameSplits.flatMap((s) => s.chars);
      const heroBits = root.querySelectorAll('.v2-hero .v2-kicker, .v2-hero-line, .v2-hero-foot');

      const num = { v: 0 };
      gsap
        .timeline({ defaults: { ease: 'power3.out' } })
        .to(num, {
          v: 100,
          duration: 1.1,
          ease: 'power2.inOut',
          onUpdate() {
            if (counter) counter.textContent = String(Math.round(num.v)).padStart(3, '0');
          },
        })
        .to(
          pre,
          {
            yPercent: -100,
            duration: 0.85,
            ease: 'power3.inOut',
            onComplete() {
              document.documentElement.classList.remove('v2-lock');
            },
          },
          '+=0.1'
        )
        .from(chars, { yPercent: 110, stagger: 0.022, duration: 0.9 }, '-=0.45')
        .from(heroBits, { y: 24, autoAlpha: 0, stagger: 0.09, duration: 0.7 }, '-=0.55')
        .set(pre, { display: 'none' });

      // hero drifts away as you scroll
      gsap.to('.v2-hero-inner', {
        yPercent: -12,
        autoAlpha: 0.15,
        ease: 'none',
        scrollTrigger: {
          trigger: '.v2-hero',
          start: 'top top',
          end: 'bottom 25%',
          scrub: true,
        },
      });

      // thesis: word-by-word reveals
      root.querySelectorAll('.v2-thesis-line').forEach((line) => {
        const split = new SplitText(line, { type: 'words', mask: 'words' });
        gsap.from(split.words, {
          yPercent: 120,
          stagger: 0.018,
          duration: 0.8,
          ease: 'power3.out',
          scrollTrigger: { trigger: line, start: 'top 85%', toggleActions: 'play none none reverse' },
        });
      });

      // generic fade-up reveals
      root.querySelectorAll('[data-reveal]').forEach((el) => {
        gsap.from(el, {
          y: 36,
          autoAlpha: 0,
          duration: 0.9,
          ease: 'power3.out',
          scrollTrigger: { trigger: el, start: 'top 88%', toggleActions: 'play none none reverse' },
        });
      });

      // venture rows cascade in
      gsap.from('.v2-vrow', {
        y: 48,
        autoAlpha: 0,
        stagger: 0.08,
        duration: 0.8,
        ease: 'power3.out',
        scrollTrigger: { trigger: '.v2-ventures', start: 'top 72%' },
      });

      // 365 counter
      const numEl = root.querySelector('.v2-count-num');
      if (numEl) {
        const o = { v: 0 };
        gsap.to(o, {
          v: 365,
          duration: 1.8,
          ease: 'power2.out',
          onUpdate() {
            numEl.textContent = String(Math.round(o.v));
          },
          scrollTrigger: { trigger: '.v2-proof', start: 'top 70%', once: true },
        });
      }

      // heatmap cells pop in
      gsap.from('.v2-cell', {
        scale: 0,
        autoAlpha: 0,
        duration: 0.4,
        ease: 'power2.out',
        stagger: { each: 0.004 },
        scrollTrigger: { trigger: '.v2-heatmap', start: 'top 82%', once: true },
      });

      // contact heading
      const big = root.querySelector('.v2-contact-big');
      if (big) {
        const split = new SplitText(big, { type: 'words', mask: 'words' });
        gsap.from(split.words, {
          yPercent: 110,
          stagger: 0.05,
          duration: 0.9,
          ease: 'power3.out',
          scrollTrigger: { trigger: big, start: 'top 85%' },
        });
      }
    }, root);

    // custom cursor (desktop, motion ok)
    if (!reduce && window.matchMedia('(pointer: fine)').matches) {
      const dot = root.querySelector<HTMLElement>('.v2-cursor');
      if (dot) {
        const xTo = gsap.quickTo(dot, 'x', { duration: 0.18, ease: 'power3.out' });
        const yTo = gsap.quickTo(dot, 'y', { duration: 0.18, ease: 'power3.out' });
        const move = (e: PointerEvent) => {
          xTo(e.clientX);
          yTo(e.clientY);
        };
        const over = (e: Event) => {
          const t = e.target as HTMLElement | null;
          dot.classList.toggle('is-on', !!t?.closest('a, button'));
        };
        window.addEventListener('pointermove', move, { passive: true });
        window.addEventListener('pointerover', over, { passive: true });
        cleanups.push(() => {
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerover', over);
        });
      }
    }

    // re-measure once fonts settle
    const refresh = () => ScrollTrigger.refresh();
    if (document.fonts?.ready) document.fonts.ready.then(refresh).catch(() => {});

    return () => {
      document.documentElement.classList.remove('v2-lock');
      cleanups.forEach((fn) => fn());
      ctx.revert();
    };
  }, []);

  return (
    <div ref={rootRef} className="v2-app">
      <ParticleScene progressRef={progressRef} />
      <div className="v2-vignette" aria-hidden="true" />
      <div className="v2-grain" aria-hidden="true" />
      <div className="v2-cursor" aria-hidden="true" />

      <div className="v2-preloader" aria-hidden="true">
        <span className="v2-preloader-name">Robin Kwee</span>
        <span className="v2-preloader-count">000</span>
      </div>

      <header className="v2-nav v2-mono">
        <a href="#top" className="v2-nav-brand">
          Robin Kwee <span>/2</span>
        </a>
        <nav className="v2-nav-links" aria-label="Sections">
          <a href="#ventures">Ventures</a>
          <a href="#proof">Proof</a>
          <a href="#contact">Contact</a>
        </nav>
        <div className="v2-nav-meta">
          <ManilaClock />
          <span>MNL</span>
        </div>
      </header>

      <main id="top" className="v2-main">
        {/* HERO */}
        <section className="v2-hero">
          <div className="v2-hero-inner">
            <p className="v2-kicker">Manila, Philippines — 14.5995° N, 120.9842° E</p>
            <h1 className="v2-hero-name">
              <span>Robin</span>
              <span>Kwee</span>
            </h1>
            <p className="v2-hero-line">
              Taking <em>AI</em> into businesses with <em>physical weight</em> — logistics, sports,
              health, distribution.
            </p>
            <div className="v2-hero-foot">
              <div className="v2-status">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/avatar.jpg" alt="Robin Kwee" width={44} height={44} />
                <div className="v2-status-text v2-mono">
                  <span className="v2-status-row">
                    <span className="v2-status-dot" />
                    Open to building
                  </span>
                  <span>AI engineers · Operators</span>
                </div>
              </div>
              <div className="v2-scrollcue v2-mono">
                <span>Scroll</span>
                <span className="v2-scrollcue-line" />
              </div>
            </div>
          </div>
        </section>

        {/* THESIS */}
        <section className="v2-thesis" aria-labelledby="thesis-heading">
          <h2 id="thesis-heading" className="v2-kicker">The thesis</h2>
          <p className="v2-thesis-line">Everyone is building AI companies.</p>
          <p className="v2-thesis-line">
            The bigger opportunity — taking AI into the <em>physical world</em>,
          </p>
          <p className="v2-thesis-line">
            where the gap between what AI can do and what incumbents do is <em>massive</em>.
          </p>
        </section>

        {/* MARQUEE */}
        <div className="v2-marquee" aria-hidden="true">
          <div className="v2-marquee-inner">
            {[0, 1].map((copy) => (
              <span key={copy}>
                {MARQUEE.map((w) => (
                  <span key={w}>
                    {w} <i>—</i>
                  </span>
                ))}
              </span>
            ))}
          </div>
        </div>

        {/* VENTURES */}
        <section id="ventures" className="v2-ventures">
          <div className="v2-sec-head v2-mono" data-reveal>
            <span>Selected ventures</span>
            <span>01 — 04</span>
          </div>
          {VENTURES.map((v) => (
            <a
              key={v.name}
              href={v.href}
              target="_blank"
              rel="noopener noreferrer"
              className="v2-vrow"
            >
              <span className="v2-vrow-idx">{v.idx}</span>
              <span className="v2-vrow-name">{v.name}</span>
              <span className="v2-vrow-meta">
                <span className="v2-vrow-tag">{v.tag}</span>
                <span className="v2-vrow-arrow">↗</span>
              </span>
              <span className="v2-vrow-desc">{v.desc}</span>
            </a>
          ))}
        </section>

        {/* PROOF */}
        <section id="proof" className="v2-proof">
          <div className="v2-proof-head" data-reveal>
            <p className="v2-kicker">Proof of work</p>
          </div>
          <div>
            <span className="v2-count-num">365</span>
            <span className="v2-count-label">
              days of <em>showing up</em> — workouts, habits, shipped code.
            </span>
          </div>
          <div data-reveal>
            <Heatmap />
            <div className="v2-proof-links">
              <Link href="/log" className="v2-textlink">
                View the log →
              </Link>
              <Link href="/blog" className="v2-textlink">
                Read the writing →
              </Link>
            </div>
          </div>
        </section>

        {/* CONTACT */}
        <section id="contact" className="v2-contact">
          <p className="v2-kicker" data-reveal>
            Contact
          </p>
          <h2 className="v2-contact-big">
            Let&apos;s build something with <i>weight</i>.
          </h2>
          <div data-reveal>
            <a href="mailto:robinkwee@gmail.com" className="v2-email">
              robinkwee@gmail.com
            </a>
          </div>
          <div data-reveal>
            <Link href="/call" className="v2-pill">
              Book a call <small>Aria sets it up · 30 min · Google Meet</small>
            </Link>
          </div>
          <div className="v2-socials" data-reveal>
            {SOCIALS.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target={s.href.startsWith('http') ? '_blank' : undefined}
                rel={s.href.startsWith('http') ? 'noopener noreferrer' : undefined}
              >
                {s.label} ↗
              </a>
            ))}
          </div>
        </section>
      </main>

      <footer className="v2-footer v2-mono">
        <span>© 2026 Robin Kwee — Manila</span>
        <span>
          Prefer the classic? <Link href="/">robinkwee.com →</Link>
        </span>
      </footer>
    </div>
  );
}
