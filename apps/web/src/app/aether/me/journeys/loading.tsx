/**
 * /aether/me/journeys — loading skeleton (AE125).
 *
 * Title block + filter chip row + 6 row stand-ins shaped like the
 * `<JourneysIndex/>` rows (date · title · status pill · cta).
 */
const COL = {
  cream: '#F2E8D5',
  creamSoft: '#E9DDC2',
  ink: '#180F0B',
  terracottaDeep: '#9A4836',
  oliveSoft: '#D9DCC8',
};

export default function MeJourneysLoading(): React.ReactElement {
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
          Journeys · gathering yours
        </p>
        <div className="aether-skel-pulse" style={{ height: 72, width: '70%', borderRadius: 8 }} />
      </section>

      {/* filter chips */}
      <section
        style={{
          maxWidth: 1100,
          margin: '32px auto 0',
          padding: '0 32px',
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
        }}
        aria-label="Loading filters"
      >
        {[80, 110, 95, 70].map((w, i) => (
          <div
            key={i}
            className="aether-skel-pulse"
            style={{ height: 30, width: w, borderRadius: 999 }}
          />
        ))}
      </section>

      {/* rows */}
      <section
        style={{
          maxWidth: 1100,
          margin: '32px auto 0',
          padding: '0 32px 96px',
        }}
        aria-label="Loading journey rows"
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            style={{
              display: 'grid',
              gridTemplateColumns: '120px 1fr 100px 80px',
              gap: 24,
              alignItems: 'center',
              padding: '24px 0',
              borderBottom: `1px solid ${COL.oliveSoft}`,
            }}
          >
            <div
              className="aether-skel-pulse"
              style={{ height: 12, width: '100%', borderRadius: 4 }}
            />
            <div
              className="aether-skel-pulse"
              style={{ height: 22, width: '80%', borderRadius: 6 }}
            />
            <div
              className="aether-skel-pulse"
              style={{ height: 22, width: '100%', borderRadius: 999 }}
            />
            <div
              className="aether-skel-pulse"
              style={{ height: 14, width: '100%', borderRadius: 4 }}
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
