'use client';

/**
 * App Router root error boundary. Reports unrecoverable top-level render
 * errors to Sentry. It replaces the root layout when it renders, so it must
 * provide its own <html>/<body>. (Required for Sentry to receive root-level
 * render crashes under both webpack and Turbopack.)
 */
import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.ReactElement {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

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
          gap: 16,
          padding: 24,
          textAlign: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          background: '#0c0d12',
          color: '#f5f3ee',
        }}
      >
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>Something went wrong</h1>
        <p style={{ margin: 0, maxWidth: 420, opacity: 0.7 }}>
          An unexpected error occurred. Try again — if it keeps happening, please let us know.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: 8,
            padding: '10px 20px',
            borderRadius: 999,
            border: 'none',
            cursor: 'pointer',
            fontWeight: 600,
            background: '#d9a441',
            color: '#1a1407',
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
