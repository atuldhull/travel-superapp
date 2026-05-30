/**
 * /aether/brand — loading skeleton (AE150).
 *
 * Brand surface mixes hero + colour swatch row + logo block. Cream
 * shimmer + reduced-motion fallback per AE115.
 */
const COL = {
  cream: '#F2E8D5',
  creamSoft: '#E9DDC2',
  ink: '#180F0B',
  terracottaDeep: '#9A4836',
  oliveSoft: '#D9DCC8',
};

export default function BrandLoading(): React.ReactElement {
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
          Brand · pulling the kit
        </p>
        <div className="aether-skel-pulse" style={{ height: 80, width: '70%', borderRadius: 8 }} />
      </section>

      {/* logo block */}
      <section
        style={{ maxWidth: 1100, margin: '32px auto', padding: '0 32px' }}
        aria-label="Loading logo block"
      >
        <div
          className="aether-skel-pulse"
          style={{ height: 240, width: '100%', borderRadius: 16 }}
        />
      </section>

      {/* colour swatches */}
      <section
        style={{
          maxWidth: 1100,
          margin: '32px auto',
          padding: '0 32px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 16,
        }}
        aria-label="Loading colour swatches"
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="aether-skel-pulse" style={{ height: 96, borderRadius: 12 }} />
            <div
              className="aether-skel-pulse"
              style={{ height: 11, width: '70%', borderRadius: 4 }}
            />
            <div
              className="aether-skel-pulse"
              style={{ height: 11, width: '50%', borderRadius: 4 }}
            />
          </div>
        ))}
      </section>

      {/* type specimen */}
      <section
        style={{
          maxWidth: 760,
          margin: '64px auto 96px',
          padding: '0 32px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
        aria-label="Loading type specimen"
      >
        {[68, 48, 18, 16, 14].map((h, i) => (
          <div
            key={i}
            className="aether-skel-pulse"
            style={{ height: h, width: `${100 - i * 10}%`, borderRadius: 6 }}
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
