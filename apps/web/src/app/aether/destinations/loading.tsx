/**
 * /aether/destinations — loading skeleton (AE115).
 *
 * Server Component, rendered by Next 15 while the client lazy chunk
 * is fetched. Editorial-shaped placeholders (3 rows of card stand-ins)
 * keep the layout from jumping when the real index hydrates. Palette
 * is the Warm Italian set hard-coded — no provider needed because no
 * client hooks run here.
 *
 * The shimmer is CSS-only (no JS), respects prefers-reduced-motion via
 * the `@media (prefers-reduced-motion)` block so reduce-motion users see
 * a calm static block instead of the pulse.
 */
const COL = {
  cream: '#F2E8D5',
  creamSoft: '#E9DDC2',
  ink: '#180F0B',
  inkSoft: '#5C4A3B',
  terracotta: '#C2614A',
  terracottaDeep: '#9A4836',
  olive: '#6E7B5C',
  oliveSoft: '#D9DCC8',
};

export default function DestinationsLoading(): React.ReactElement {
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
            color: COL.terracottaDeep,
            fontWeight: 600,
            margin: 0,
            marginBottom: 12,
          }}
        >
          Destinations · loading the road
        </p>
        <div className="aether-skel-pulse" style={skel.title} />
        <div className="aether-skel-pulse" style={{ ...skel.lede, marginTop: 24 }} />
      </section>

      <section
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          padding: '24px 32px 96px',
        }}
        aria-label="Loading destination cards"
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 24,
          }}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              style={{
                borderRadius: 12,
                background: COL.creamSoft,
                border: `1px solid ${COL.oliveSoft}`,
                padding: 24,
                minHeight: 280,
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              <div className="aether-skel-pulse" style={skel.kicker} />
              <div className="aether-skel-pulse" style={skel.cardTitle} />
              <div className="aether-skel-pulse" style={skel.row} />
              <div className="aether-skel-pulse" style={{ ...skel.row, width: '78%' }} />
              <div className="aether-skel-pulse" style={{ ...skel.row, width: '62%' }} />
            </div>
          ))}
        </div>
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
          border-radius: 6px;
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

const skel = {
  title: { height: 72, width: '70%', margin: '0 auto', borderRadius: 8 },
  lede: { height: 18, width: '52%', margin: '0 auto', borderRadius: 4 },
  kicker: { height: 11, width: 120, borderRadius: 4 },
  cardTitle: { height: 28, width: '70%', borderRadius: 6 },
  row: { height: 12, width: '94%', borderRadius: 4 },
};
