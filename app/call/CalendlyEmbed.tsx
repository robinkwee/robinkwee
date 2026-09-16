'use client';

import Script from 'next/script';
import { useEffect, useRef, useState } from 'react';

/**
 * Calendly inline widget.
 *
 * `widget.js` is a third-party script, and third-party scripts do not always
 * arrive: privacy extensions and content blockers routinely block Calendly,
 * and a page whose only booking path is an iframe that never appears is a dead
 * page. So the widget is the enhancement, not the mechanism — the direct
 * scheduling link is always reachable, and if the iframe has not mounted
 * shortly after load the reserved space collapses and the link is promoted to
 * the primary call to action rather than leaving a screen-high hole.
 */

const WIDGET_SRC = 'https://assets.calendly.com/assets/external/widget.js';
/** How long to wait for the iframe before assuming the script was blocked. */
const MOUNT_TIMEOUT_MS = 6000;
const POLL_INTERVAL_MS = 250;

interface CalendlyApi {
  initInlineWidget(options: { url: string; parentElement: HTMLElement }): void;
}

declare global {
  interface Window {
    Calendly?: CalendlyApi;
  }
}

export default function CalendlyEmbed({
  embedUrl,
  schedulingUrl,
}: {
  embedUrl: string;
  schedulingUrl: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const initialisedRef = useRef(false);
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');

  /**
   * Initialise explicitly rather than relying on the script's own scan of the
   * document: on a client-side navigation the script is already loaded, so
   * that scan has long since run and would never see this element.
   */
  const mount = () => {
    if (initialisedRef.current) return;
    const parentElement = containerRef.current;
    if (!parentElement || !window.Calendly) return;

    initialisedRef.current = true;
    try {
      window.Calendly.initInlineWidget({ url: embedUrl, parentElement });
    } catch (err) {
      // Deliberately not setting state here: this runs synchronously from an
      // effect on a client-side navigation. A throw means no iframe appears,
      // which is exactly what the poll below already looks for.
      console.error('Calendly widget failed to initialise:', err);
    }
  };

  useEffect(() => {
    // Covers the client-side navigation case, where onReady never fires again.
    mount();

    const startedAt = Date.now();
    const poll = setInterval(() => {
      if (containerRef.current?.querySelector('iframe')) {
        setStatus('ready');
        clearInterval(poll);
        return;
      }
      if (Date.now() - startedAt >= MOUNT_TIMEOUT_MS) {
        setStatus('unavailable');
        clearInterval(poll);
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(poll);
    // `embedUrl` is fixed for the life of the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const blocked = status === 'unavailable';

  return (
    <div>
      <Script
        src={WIDGET_SRC}
        strategy="afterInteractive"
        onReady={mount}
        onError={() => setStatus('unavailable')}
      />

      {blocked ? (
        <div className="rounded-xl border border-gray-800 bg-[#111] p-6 text-center">
          <p className="text-sm text-gray-300">The calendar couldn&apos;t load on this page.</p>
          <p className="mx-auto mt-2 max-w-sm text-xs text-gray-500">
            A privacy extension or content blocker is the usual cause. The booking page itself works
            normally.
          </p>
          <a
            href={schedulingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-block rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-500"
          >
            Open the booking page →
          </a>
        </div>
      ) : (
        <>
          {status === 'loading' && (
            <p className="mb-3 text-center text-xs text-gray-600" role="status">
              Loading available times…
            </p>
          )}
          <div
            ref={containerRef}
            className="calendly-inline-widget h-[860px] w-full overflow-hidden rounded-xl sm:h-[720px]"
            style={{ minWidth: 280 }}
            aria-label="Booking calendar"
          />
          <p className="mt-4 text-center text-xs text-gray-600">
            Trouble with the calendar?{' '}
            <a
              href={schedulingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-400 underline underline-offset-4 hover:text-emerald-300"
            >
              Open it in a new tab
            </a>
            .
          </p>
        </>
      )}

      <noscript>
        <p className="mt-4 text-center text-sm text-gray-400">
          Booking needs JavaScript —{' '}
          <a
            href={schedulingUrl}
            className="text-emerald-400 underline underline-offset-4"
            target="_blank"
            rel="noopener noreferrer"
          >
            open the booking page directly
          </a>
          .
        </p>
      </noscript>
    </div>
  );
}
