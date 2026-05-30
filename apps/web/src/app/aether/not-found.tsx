/**
 * /aether/* not-found — Aether-styled 404 surface.
 *
 * Next 15 auto-mounts this when any /aether/* route calls
 * `notFound()` (which our env-gated page.tsx files do when the
 * feature flag is off, and which dynamic slug pages do on a miss).
 * Without this file the user sees the root app's 404 — jarring
 * because the typography / palette flip.
 *
 * Server Component on purpose — no client hooks, no provider needed.
 * The palette values are hard-coded to the Warm Italian hexes so the
 * page renders correctly before any client bundle hydrates.
 */
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Aether · Off the road',
  description: 'This road does not exist (yet).',
  robots: { index: false, follow: false },
};

const COL = {
  cream: '#F2E8D5',
  ink: '#180F0B',
  inkSoft: '#5C4A3B',
  terracotta: '#C2614A',
  terracottaDeep: '#9A4836',
  ochre: '#C28A4A',
  olive: '#6E7B5C',
};

export default function AetherNotFound(): React.ReactElement {
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
            background: COL.terracotta,
            color: COL.cream,
            marginBottom: 24,
          }}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill={COL.cream}>
            <circle
              cx="12"
              cy="11"
              r="6.4"
              fill="none"
              stroke={COL.cream}
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            <circle cx="12" cy="4.5" r="1.4" />
            <path
              d="M 12 17.4 C 13.6 18.6, 15.4 19.0, 16.8 18.4 C 18.0 17.9, 18.4 16.6, 17.4 15.8"
              fill="none"
              stroke={COL.cream}
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="12" cy="11" r="1.2" />
          </svg>
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
          404 · off the road
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
          This road doesn’t exist.
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
          The path you tried may have been retired, never built, or hidden behind a flag. Pick a
          known way back below.
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
          <Link
            href="/aether/drift"
            style={{
              padding: '14px 28px',
              borderRadius: 999,
              background: COL.terracotta,
              color: COL.cream,
              fontFamily: 'var(--font-inter), system-ui, sans-serif',
              fontSize: 14,
              fontWeight: 600,
              textDecoration: 'none',
              letterSpacing: '0.01em',
              boxShadow: '0 8px 24px rgba(194, 97, 74, 0.32)',
            }}
          >
            ↩ Back to Drift
          </Link>
          <Link
            href="/aether/atlas"
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
            Open the Atlas
          </Link>
          <Link
            href="/aether/destinations"
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
            Pick a destination
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
