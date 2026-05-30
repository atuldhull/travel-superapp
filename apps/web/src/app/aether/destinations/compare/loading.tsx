/**
 * /aether/destinations/compare — loading skeleton (AE166).
 *
 * Twin-column hero + facts grid + paired ledes. Mirrors the AE73
 * comparison surface so the cream→hydrate doesn't snap layout.
 */
const COL = {
  cream: '#F2E8D5',
  creamSoft: '#E9DDC2',
  ink: '#180F0B',
  terracottaDeep: '#9A4836',
  oliveSoft: '#D9DCC8',
};

export default function CompareLoading(): React.ReactElement {
  return (
    <div
      style={{
        background: COL.cream,
        color: COL.ink,
        minHeight: '100vh',
        fontFamily: 'var(--font-inter), system-ui, -apple-system, sans-serif',
      }}
      aria-busy="true"
      aria-live="polite"
    >
      <section style={{ maxWidth: 1280, margin: '0 auto', padding: '96px 32px 32px' }}>
        <p
          style={{
            fontSize: 11,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: COL.terracottaDeep,
            fontWeight: 600,
            margin: 0,
            marginBottom: 12,
          }}
        >
          Compare · pulling both ledes
        </p>
        <div className="aether-skel-pulse" style={{ height: 64, width: '70%', borderRadius: 8 }} />
      </section>

      <section
        style={{
          maxWidth: 1280,
          margin: '32px auto 0',
          padding: '0 32px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: 32,
        }}
        aria-label="Loading twin destinations"
      >
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            style={{
              borderRadius: 12,
              overflow: 'hidden',
              background: COL.creamSoft,
              border: `1px solid ${COL.oliveSoft}`,
            }}
          >
            <div className="aether-skel-pulse" style={{ height: 280 }} />
            <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div
                className="aether-skel-pulse"
                style={{ height: 11, width: 110, borderRadius: 4 }}
              />
              <div
                className="aether-skel-pulse"
                style={{ height: 34, width: '70%', borderRadius: 6 }}
              />
              <div
                className="aether-skel-pulse"
                style={{ height: 14, width: '94%', borderRadius: 4 }}
              />
              <div
                className="aether-skel-pulse"
                style={{ height: 14, width: '90%', borderRadius: 4 }}
              />
              <div
                className="aether-skel-pulse"
                style={{ height: 14, width: '74%', borderRadius: 4 }}
              />
              <div
                className="aether-skel-pulse"
                style={{ height: 44, width: 180, borderRadius: 999, marginTop: 8 }}
              />
            </div>
          </div>
        ))}
      </section>

      <div style={{ height: 96 }} />

      <style>{`
        .aether-skel-pulse {
          background: linear-gradient(
            90deg,
            ${COL.oliveSoft} 0%,
            ${COL.creamSoft} 50%,
            ${COL.oliveSoft} 100%
          );
          background-size: 200% 100%;
          animation: aether-skel-shimmer 1.6s ease-in-out infinite;
        }
        @keyframes aether-skel-shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .aether-skel-pulse {
            animation: none;
            background: ${COL.oliveSoft};
          }
        }
      `}</style>
    </div>
  );
}
