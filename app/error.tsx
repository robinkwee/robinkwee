'use client';

import { useEffect } from 'react';

/**
 * Route-level error boundary. Without one, a render error anywhere below the
 * root layout takes the page to a blank screen with no way back.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Route error:', error);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#060606] px-6 text-center text-white">
      <p className="font-mono text-xs uppercase tracking-widest text-gray-600">Something broke</p>
      <h1 className="text-2xl font-light tracking-tight">This page failed to load.</h1>
      <p className="max-w-sm text-sm text-gray-500">
        Try again — if it keeps happening, email{' '}
        <a className="text-gray-300 underline underline-offset-4" href="mailto:robinkwee@gmail.com">
          robinkwee@gmail.com
        </a>
        .
      </p>
      {error.digest && <p className="font-mono text-[11px] text-gray-700">ref {error.digest}</p>}
      <div className="mt-2 flex gap-4 text-sm">
        <button onClick={reset} className="text-emerald-400 hover:text-emerald-300">
          Try again
        </button>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a full reload is the point: a client-side nav can re-enter the broken router state */}
        <a href="/" className="text-gray-400 hover:text-white">
          Go home
        </a>
      </div>
    </main>
  );
}
