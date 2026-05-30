/**
 * /aether/status — loading skeleton (AE166).
 *
 * AE75 operator status surface — flag chip + health chip + route
 * counts + build sha row. Mostly metric tiles.
 */
const COL = {
  cream: '#F2E8D5',
  creamSoft: '#E9DDC2',
  ink: '#180F0B',
  terracottaDeep: '#9A4836',
  oliveSoft: '#D9DCC8',
};

export default function StatusLoading(): React.ReactElement {
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
      <section style={{ maxWidth: 900, margin: '0 auto', padding: '96px 32px 32px' }}>
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
          Status · pinging
        </p>
        <div className="aether-skel-pulse" style={{ height: 64, width: '70%', borderRadius: 8 }} />
      </section>

      <section
        style={{
          maxWidth: 900,
          margin: '32px auto 0',
          padding: '0 32px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
        }}
        aria-label="Loading status tiles"
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            style={{
              padding: 24,
              borderRadius: 12,
              background: COL.creamSoft,
              border: `1px solid ${COL.oliveSoft}`,
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
              style={{ height: 14, width: '80%', borderRadius: 4, marginTop: 12 }}
            />
          </div>
        ))}
      </section>

      <section
        style={{
          maxWidth: 900,
          margin: '32px auto 96px',
          padding: '0 32px',
        }}
        aria-label="Loading route table"
      >
        <div className="aether-skel-pulse" style={{ height: 22, width: 200, borderRadius: 6 }} />
        <div style={{ marginTop: 16, display: 'grid', gap: 8 }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="aether-skel-pulse"
              style={{ height: 14, width: `${88 - i * 4}%`, borderRadius: 4 }}
            />
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
