/**
 * /aether/destinations/[slug] — loading skeleton (AE115).
 *
 * Editorial hero placeholder (ochre eyebrow + huge title bar + dek)
 * then a 3-up facts row (season / pace / budget shape) and a long-form
 * lede block. Mirrors the destination-page composition so the layout
 * doesn't jump on hydrate.
 */
const COL = {
  cream: '#F2E8D5',
  creamSoft: '#E9DDC2',
  ink: '#180F0B',
  terracottaDeep: '#9A4836',
  oliveSoft: '#D9DCC8',
};

export default function DestinationDetailLoading(): React.ReactElement {
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
          padding: '96px 32px 48px',
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
          Destination · pulling the lede
        </p>
        <div className="aether-skel-pulse" style={{ height: 80, width: '85%', borderRadius: 8 }} />
        <div
          className="aether-skel-pulse"
          style={{ height: 80, width: '60%', borderRadius: 8, marginTop: 8 }}
        />
        <div
          className="aether-skel-pulse"
          style={{ height: 18, width: '70%', borderRadius: 4, marginTop: 32 }}
        />
      </section>

      <section
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          padding: '24px 32px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 24,
          borderTop: `1px solid ${COL.oliveSoft}`,
          borderBottom: `1px solid ${COL.oliveSoft}`,
        }}
        aria-label="Loading facts strip"
      >
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} style={{ padding: '24px 0', textAlign: 'center' }}>
            <div
              className="aether-skel-pulse"
              style={{ height: 11, width: 80, margin: '0 auto', borderRadius: 4 }}
            />
            <div
              className="aether-skel-pulse"
              style={{ height: 28, width: '70%', margin: '12px auto 0', borderRadius: 6 }}
            />
          </div>
        ))}
      </section>

      <section
        style={{
          maxWidth: 720,
          margin: '0 auto',
          padding: '96px 32px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
        aria-label="Loading lede"
      >
        {[100, 96, 92, 88, 78].map((w, i) => (
          <div
            key={i}
            className="aether-skel-pulse"
            style={{ height: 16, width: `${w}%`, borderRadius: 4 }}
          />
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
