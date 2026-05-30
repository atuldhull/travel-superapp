/**
 * /aether/atlas — loading skeleton (AE120).
 *
 * Atlas uses Leaflet behind dynamic({ssr:false}); the chunk is heavy
 * (CartoDB tiles + map JS). This skeleton paints the header eyebrow,
 * a big title bar, the "Where am I?" pill row, the map block, and
 * the destinations list rows — same shape the real surface lands in.
 *
 * Background is ink-dark (not cream) because Atlas inverts the
 * palette to a night-sky surface; matching that here prevents the
 * jarring cream → ink flash on first paint.
 */
const COL = {
  inkDeep: '#0E0908',
  ink: '#180F0B',
  inkSoft: '#3D2D24',
  cream: '#F2E8D5',
  creamSoft: '#E9DDC2',
  ochreGlow: '#D9A66B',
  oliveSoft: '#363C2C',
};

export default function AtlasLoading(): React.ReactElement {
  return (
    <div
      style={{
        background: COL.ink,
        color: COL.cream,
        minHeight: '100vh',
        fontFamily: 'var(--font-inter), system-ui, -apple-system, sans-serif',
      }}
      aria-busy="true"
      aria-live="polite"
    >
      <section
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          padding: '96px 32px 48px',
          textAlign: 'center',
        }}
      >
        <p
          style={{
            fontSize: 11,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: COL.ochreGlow,
            fontWeight: 600,
            margin: 0,
            marginBottom: 12,
          }}
        >
          Atlas · drawing the map
        </p>
        <div
          className="aether-skel-pulse-dark"
          style={{ height: 80, width: '70%', margin: '0 auto', borderRadius: 8 }}
        />
        <div
          className="aether-skel-pulse-dark"
          style={{ height: 18, width: '46%', margin: '24px auto 0', borderRadius: 4 }}
        />
        <div
          className="aether-skel-pulse-dark"
          style={{ height: 40, width: 180, margin: '32px auto 0', borderRadius: 999 }}
        />
      </section>

      {/* The map block — large, ~4:5 aspect, rounded */}
      <section
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          padding: '24px 32px',
        }}
        aria-label="Loading the map"
      >
        <div
          className="aether-skel-pulse-dark"
          style={{
            width: '100%',
            aspectRatio: '4 / 5',
            maxHeight: 720,
            borderRadius: 16,
          }}
        />
      </section>

      {/* Listing skeleton — 8 row stand-ins */}
      <section
        style={{
          maxWidth: 1280,
          margin: '48px auto 0',
          padding: '0 32px 96px',
        }}
        aria-label="Loading destinations list"
      >
        <div
          className="aether-skel-pulse-dark"
          style={{ height: 36, width: 280, borderRadius: 8 }}
        />
        <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              style={{
                display: 'grid',
                gridTemplateColumns: '60px 1fr 1fr 90px',
                gap: 16,
                padding: '16px 0',
                borderBottom: `1px solid rgba(242, 232, 213, 0.08)`,
              }}
            >
              <div
                className="aether-skel-pulse-dark"
                style={{ height: 12, width: 30, borderRadius: 4 }}
              />
              <div
                className="aether-skel-pulse-dark"
                style={{ height: 22, width: '70%', borderRadius: 6 }}
              />
              <div
                className="aether-skel-pulse-dark"
                style={{ height: 16, width: '78%', borderRadius: 4 }}
              />
              <div
                className="aether-skel-pulse-dark"
                style={{ height: 14, width: 60, borderRadius: 4 }}
              />
            </div>
          ))}
        </div>
      </section>

      <style>{`
        .aether-skel-pulse-dark {
          background: linear-gradient(
            90deg,
            ${COL.oliveSoft} 0%,
            ${COL.inkSoft} 50%,
            ${COL.oliveSoft} 100%
          );
          background-size: 200% 100%;
          animation: aether-skel-shimmer-dark 1.6s ease-in-out infinite;
        }
        @keyframes aether-skel-shimmer-dark {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .aether-skel-pulse-dark {
            animation: none;
            background: ${COL.inkSoft};
          }
        }
      `}</style>
    </div>
  );
}
