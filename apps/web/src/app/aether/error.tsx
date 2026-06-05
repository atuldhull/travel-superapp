'use client';

/**
 * /aether/* error boundary — Aether-styled 500 surface (AE105,
 * companion to AE92's not-found). Next 15 mounts this when any
 * Aether route throws during render. Must be a Client Component
 * because it captures the error + offers a reset() handler.
 *
 * Server Component would simplify SSR, but Next requires the
 * 'use client' directive on error.tsx so the runtime can wire the
 * reset bridge. We keep the surface dependency-free (no
 * AetherProvider, no theme hook) so a faulty theme can't itself
 * crash the error page.
 */
import { useEffect } from 'react';
import Link from 'next/link';

const COL = {
  cream: '#F2E8D5',
  ink: '#180F0B',
  inkSoft: '#5C4A3B',
  terracotta: '#C2614A',
  terracottaDeep: '#9A4836',
  ochre: '#C28A4A',
  olive: '#6E7B5C',
};

interface Props {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}

export default function AetherError({ error, reset }: Props): React.ReactElement {
  useEffect(() => {
    // Sentry / OTel auto-captures unhandled errors; log here too for
    // local visibility. console.error is the standard Next pattern for
    // error.tsx — `@app/logger` runs server-only.

    console.error('aether error.tsx', error);
  }, [error]);

  return (
    <div
      style={{
        background: COL.cream,
        color: COL.ink,
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        fontFamily: 'var(--font-inter), system-ui, -apple-system, sans-serif',
      }}
    >
      <div style={{ maxWidth: 640, textAlign: 'center' }}>
        <span
          aria-hidden
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 56,
            height: 56,
            borderRadius: 999,
            background: COL.terracottaDeep,
            color: COL.cream,
            marginBottom: 24,
            fontFamily: 'var(--font-playfair), Georgia, serif',
            fontSize: 26,
            fontWeight: 600,
          }}
        >
          !
        </span>
        <p
          style={{
            fontFamily: 'var(--font-inter), system-ui, sans-serif',
            fontSize: 11,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: COL.terracottaDeep,
            fontWeight: 600,
            margin: 0,
            marginBottom: 12,
          }}
        >
          500 · the road went quiet
        </p>
        <h1
          style={{
            fontFamily: 'var(--font-playfair), Georgia, serif',
            fontSize: 'clamp(40px, 6vw, 80px)',
            lineHeight: 1.02,
            letterSpacing: '-0.024em',
            fontWeight: 600,
            margin: 0,
            color: COL.ink,
          }}
        >
          Something broke on the way.
        </h1>
        <p
          style={{
            fontFamily: 'var(--font-playfair), Georgia, serif',
            fontStyle: 'italic',
            fontSize: 'clamp(18px, 2vw, 23px)',
            lineHeight: 1.55,
            color: COL.inkSoft,
            margin: '32px auto 0',
            maxWidth: '46ch',
          }}
        >
          We logged it. Try the page again, or pick a known way back below. If it keeps happening,
          mention the digest <code>{error.digest ?? '—'}</code> when you write in.
        </p>

        <div
          style={{
            marginTop: 40,
            display: 'flex',
            gap: 12,
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            onClick={reset}
            style={{
              padding: '14px 28px',
              borderRadius: 999,
              background: COL.terracotta,
              color: COL.cream,
              border: 'none',
              fontFamily: 'var(--font-inter), system-ui, sans-serif',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              letterSpacing: '0.01em',
              boxShadow: '0 8px 24px rgba(194, 97, 74, 0.32)',
            }}
          >
            ↻ Try again
          </button>
          <Link
            href="/aether/drift"
            style={{
              padding: '12px 24px',
              borderRadius: 999,
              background: 'transparent',
              color: COL.ink,
              border: `1px solid ${COL.ink}`,
              fontFamily: 'var(--font-inter), system-ui, sans-serif',
              fontSize: 13,
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            ↩ Back to Drift
          </Link>
          <Link
            href="/aether/status"
            style={{
              padding: '12px 24px',
              borderRadius: 999,
              background: 'transparent',
              color: COL.olive,
              border: `1px solid ${COL.olive}`,
              fontFamily: 'var(--font-inter), system-ui, sans-serif',
              fontSize: 13,
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Check /aether/status
          </Link>
        </div>

        <p
          style={{
            marginTop: 56,
            fontFamily: 'JetBrains Mono, ui-monospace, monospace',
            fontSize: 11,
            color: COL.ochre,
            letterSpacing: '0.14em',
            opacity: 0.78,
          }}
        >
          TravelSuperApp · Aether 2.0
        </p>
      </div>
    </div>
  );
}
