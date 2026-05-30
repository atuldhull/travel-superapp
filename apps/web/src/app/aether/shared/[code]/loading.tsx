/**
 * /aether/shared/[code] — loading skeleton (AE166).
 *
 * Aether-styled read-only view of a shared trip (AE48). Hero title +
 * facts strip + itinerary card placeholders + clone CTA.
 */
const COL = {
  cream: '#F2E8D5',
  creamSoft: '#E9DDC2',
  ink: '#180F0B',
  terracottaDeep: '#9A4836',
  oliveSoft: '#D9DCC8',
};

export default function SharedLoading(): React.ReactElement {
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
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '96px 32px 24px' }}>
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
          A shared journey · loading
        </p>
        <div className="aether-skel-pulse" style={{ height: 72, width: '78%', borderRadius: 8 }} />
      </section>

      <section
        style={{
          maxWidth: 1100,
          margin: '32px auto 0',
          padding: '0 32px',
        }}
        aria-label="Loading trip facts"
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            border: `1px solid ${COL.oliveSoft}`,
            borderRadius: 12,
            background: COL.creamSoft,
            overflow: 'hidden',
          }}
        >
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              style={{
                padding: '20px 16px',
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
                style={{ height: 24, width: '60%', margin: '10px auto 0', borderRadius: 6 }}
              />
            </div>
          ))}
        </div>
      </section>

      <section
        style={{
          maxWidth: 720,
          margin: '64px auto 0',
          padding: '0 32px 32px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
        aria-label="Loading lede"
      >
        {[100, 96, 90, 86, 70].map((w, i) => (
          <div
            key={i}
            className="aether-skel-pulse"
            style={{ height: 16, width: `${w}%`, borderRadius: 4 }}
          />
        ))}
      </section>

      <section
        style={{
          maxWidth: 1100,
          margin: '48px auto 96px',
          padding: '0 32px',
          display: 'flex',
          justifyContent: 'center',
          gap: 12,
        }}
        aria-label="Loading clone CTA"
      >
        <div className="aether-skel-pulse" style={{ height: 44, width: 200, borderRadius: 999 }} />
        <div className="aether-skel-pulse" style={{ height: 44, width: 140, borderRadius: 999 }} />
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
