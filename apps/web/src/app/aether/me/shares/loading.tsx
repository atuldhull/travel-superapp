/**
 * /aether/me/shares — loading skeleton (AE125).
 *
 * Title block + per-trip share band placeholders. Each band has a
 * title + 1–2 link rows shaped like `<TripShareBand/>` results.
 */
const COL = {
  cream: '#F2E8D5',
  creamSoft: '#E9DDC2',
  ink: '#180F0B',
  terracottaDeep: '#9A4836',
  oliveSoft: '#D9DCC8',
};

export default function MeSharesLoading(): React.ReactElement {
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
          Shares · gathering links
        </p>
        <div className="aether-skel-pulse" style={{ height: 72, width: '64%', borderRadius: 8 }} />
      </section>

      <section
        style={{
          maxWidth: 1100,
          margin: '32px auto 0',
          padding: '0 32px 96px',
          display: 'grid',
          gap: 32,
        }}
        aria-label="Loading share bands"
      >
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            style={{
              padding: 24,
              borderRadius: 12,
              border: `1px solid ${COL.oliveSoft}`,
              background: COL.creamSoft,
            }}
          >
            <div
              className="aether-skel-pulse"
              style={{ height: 11, width: 110, borderRadius: 4 }}
            />
            <div
              className="aether-skel-pulse"
              style={{ height: 28, width: '60%', borderRadius: 6, marginTop: 12 }}
            />
            {/* link rows */}
            <div style={{ marginTop: 24, display: 'grid', gap: 12 }}>
              {Array.from({ length: 2 }).map((__, j) => (
                <div
                  key={j}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 70px 70px',
                    gap: 12,
                    alignItems: 'center',
                  }}
                >
                  <div
                    className="aether-skel-pulse"
                    style={{ height: 16, width: '100%', borderRadius: 4 }}
                  />
                  <div
                    className="aether-skel-pulse"
                    style={{ height: 26, width: '100%', borderRadius: 999 }}
                  />
                  <div
                    className="aether-skel-pulse"
                    style={{ height: 26, width: '100%', borderRadius: 999 }}
                  />
                </div>
              ))}
            </div>
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
