/**
 * /aether/me — loading skeleton (AE125).
 *
 * Editorial title block + 4-tile stats + 3 large editorial cards.
 * Mirrors `<MeHome/>` composition so the cream-on-cream transition
 * doesn't jump on Tab → /aether/me.
 */
const COL = {
  cream: '#F2E8D5',
  creamSoft: '#E9DDC2',
  ink: '#180F0B',
  terracottaDeep: '#9A4836',
  oliveSoft: '#D9DCC8',
};

export default function MeLoading(): React.ReactElement {
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
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '96px 32px 32px' }}>
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
          My atlas · loading
        </p>
        <div className="aether-skel-pulse" style={{ height: 80, width: '64%', borderRadius: 8 }} />
      </section>

      <section
        style={{ maxWidth: 1100, margin: '32px auto 0', padding: '0 32px' }}
        aria-label="Loading stats strip"
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
                style={{ height: 11, width: 80, margin: '0 auto', borderRadius: 4 }}
              />
              <div
                className="aether-skel-pulse"
                style={{ height: 28, width: '60%', margin: '12px auto 0', borderRadius: 6 }}
              />
            </div>
          ))}
        </div>
      </section>

      <section
        style={{
          maxWidth: 1100,
          margin: '48px auto 0',
          padding: '0 32px 96px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: 24,
        }}
        aria-label="Loading editorial cards"
      >
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            style={{
              minHeight: 280,
              padding: 32,
              borderRadius: 12,
              background: COL.creamSoft,
              border: `1px solid ${COL.oliveSoft}`,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
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
              style={{ height: 14, width: '88%', borderRadius: 4 }}
            />
            <div
              className="aether-skel-pulse"
              style={{ height: 14, width: '74%', borderRadius: 4 }}
            />
            <div
              className="aether-skel-pulse"
              style={{ height: 14, width: 120, borderRadius: 4, marginTop: 'auto' }}
            />
          </div>
        ))}
      </section>

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
