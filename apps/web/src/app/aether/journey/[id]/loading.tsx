/**
 * /aether/journey/[id] — loading skeleton (AE115).
 *
 * Title block + status chip + 4-tile facts strip + a row of action
 * pills. Matches the JourneyDashboard composition so first paint
 * after navigation is layout-stable.
 */
const COL = {
  cream: '#F2E8D5',
  creamSoft: '#E9DDC2',
  ink: '#180F0B',
  terracottaDeep: '#9A4836',
  oliveSoft: '#D9DCC8',
  inkWhisper: '#E9DDC2',
};

export default function JourneyLoading(): React.ReactElement {
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
      <section
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          padding: '96px 32px 24px',
        }}
      >
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
          Your journey · loading
        </p>
        <div className="aether-skel-pulse" style={{ height: 72, width: '78%', borderRadius: 8 }} />
        <div
          className="aether-skel-pulse"
          style={{ height: 72, width: '52%', borderRadius: 8, marginTop: 8 }}
        />
      </section>

      {/* 4-tile facts strip */}
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

      {/* action pill row */}
      <section
        style={{
          maxWidth: 1100,
          margin: '32px auto 0',
          padding: '0 32px',
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
        }}
        aria-label="Loading actions"
      >
        {[140, 120, 110, 100, 130].map((w, i) => (
          <div
            key={i}
            className="aether-skel-pulse"
            style={{ height: 36, width: w, borderRadius: 999 }}
          />
        ))}
      </section>

      {/* itinerary day cards */}
      <section
        style={{
          maxWidth: 1100,
          margin: '96px auto 0',
          padding: '0 32px 96px',
          display: 'grid',
          gap: 24,
        }}
        aria-label="Loading itinerary"
      >
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            style={{
              border: `1px solid ${COL.oliveSoft}`,
              borderRadius: 12,
              padding: 24,
              background: COL.creamSoft,
            }}
          >
            <div
              className="aether-skel-pulse"
              style={{ height: 11, width: 100, borderRadius: 4 }}
            />
            <div
              className="aether-skel-pulse"
              style={{ height: 28, width: '60%', borderRadius: 6, marginTop: 12 }}
            />
            <div
              className="aether-skel-pulse"
              style={{ height: 14, width: '90%', borderRadius: 4, marginTop: 16 }}
            />
            <div
              className="aether-skel-pulse"
              style={{ height: 14, width: '74%', borderRadius: 4, marginTop: 8 }}
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
