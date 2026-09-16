'use client';

/**
 * Last-resort boundary for failures in the root layout itself. It replaces the
 * whole document, so it must render its own <html> and <body> and cannot rely
 * on the app's stylesheets being present.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          background: '#060606',
          color: '#ededed',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          textAlign: 'center',
          padding: '0 24px',
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 300, margin: 0 }}>Something went wrong.</h1>
        <p style={{ fontSize: 14, color: '#908d84', margin: 0 }}>
          Try reloading. If it persists, email robinkwee@gmail.com.
        </p>
        {error.digest && (
          <p style={{ fontSize: 11, color: '#4b4b4b', margin: 0 }}>ref {error.digest}</p>
        )}
        <button
          onClick={reset}
          style={{
            marginTop: 8,
            background: 'none',
            border: '1px solid #2b2b2b',
            borderRadius: 8,
            color: '#34d399',
            padding: '8px 16px',
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
