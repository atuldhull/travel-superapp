/**
 * /aether/drift — loading skeleton (AE151).
 *
 * Hero photo block + statstrip + esperienze grid + voices + journal
 * preview row. This page is photo-heavy; the skeleton paints a tall
 * hero placeholder + below-fold scaffolding so the parallax doesn't
 * snap layout on hydrate.
 */
const COL = {
  cream: '#F2E8D5',
  creamSoft: '#E9DDC2',
  ink: '#180F0B',
  terracottaDeep: '#9A4836',
  oliveSoft: '#D9DCC8',
};

export default function DriftLoading(): React.ReactElement {
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
      {/* Hero photo + overlay copy */}
      <section
        style={{
          position: 'relative',
          width: '100%',
          height: '85vh',
          background: COL.creamSoft,
        }}
        aria-label="Loading hero"
      >
        <div className="aether-skel-pulse" style={{ position: 'absolute', inset: 0 }} />
        <div
          style={{
            position: 'absolute',
            bottom: 56,
            left: 32,
            right: 32,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            maxWidth: 720,
          }}
        >
          <div
            className="aether-skel-pulse"
            style={{ height: 11, width: 220, borderRadius: 4, background: '#D6CBB066' }}
          />
          <div
            className="aether-skel-pulse"
            style={{ height: 64, width: '88%', borderRadius: 6, background: '#D6CBB066' }}
          />
          <div
            className="aether-skel-pulse"
            style={{ height: 18, width: '52%', borderRadius: 4, background: '#D6CBB066' }}
          />
        </div>
      </section>

      {/* statstrip */}
      <section
        style={{
          maxWidth: 1280,
          margin: '64px auto 0',
          padding: '0 32px',
        }}
        aria-label="Loading stat strip"
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            border: `1px solid ${COL.oliveSoft}`,
            borderRadius: 12,
            background: COL.creamSoft,
            overflow: 'hidden',
          }}
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              style={{
                padding: '24px 16px',
                borderLeft: i > 0 ? `1px solid ${COL.oliveSoft}` : 'none',
                textAlign: 'center',
              }}
            >
              <div
                className="aether-skel-pulse"
                style={{ height: 30, width: '60%', margin: '0 auto', borderRadius: 6 }}
              />
              <div
                className="aether-skel-pulse"
                style={{ height: 11, width: 80, margin: '12px auto 0', borderRadius: 4 }}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Esperienze (cards) */}
      <section
        style={{
          maxWidth: 1280,
          margin: '64px auto 0',
          padding: '0 32px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 24,
        }}
        aria-label="Loading cards"
      >
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            style={{
              borderRadius: 12,
              overflow: 'hidden',
              background: COL.creamSoft,
              border: `1px solid ${COL.oliveSoft}`,
            }}
          >
            <div className="aether-skel-pulse" style={{ height: 200 }} />
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div
                className="aether-skel-pulse"
                style={{ height: 22, width: '70%', borderRadius: 6 }}
              />
              <div
                className="aether-skel-pulse"
                style={{ height: 14, width: '90%', borderRadius: 4 }}
              />
              <div
                className="aether-skel-pulse"
                style={{ height: 14, width: '80%', borderRadius: 4 }}
              />
            </div>
          </div>
        ))}
      </section>

      <div style={{ height: 128 }} />

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
