/**
 * /aether/journal — loading skeleton (AE120).
 *
 * Index of long-form articles. Editorial 2-column grid placeholder.
 * Hard-coded Warm Italian hexes so the skeleton paints before the
 * client lazy chunk hydrates.
 */
const COL = {
  cream: '#F2E8D5',
  creamSoft: '#E9DDC2',
  ink: '#180F0B',
  terracottaDeep: '#9A4836',
  oliveSoft: '#D9DCC8',
};

export default function JournalLoading(): React.ReactElement {
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
          The journal · gathering pages
        </p>
        <div
          className="aether-skel-pulse"
          style={{ height: 80, width: '64%', margin: '0 auto', borderRadius: 8 }}
        />
        <div
          className="aether-skel-pulse"
          style={{ height: 18, width: '48%', margin: '24px auto 0', borderRadius: 4 }}
        />
      </section>

      <section
        style={{
          maxWidth: 1120,
          margin: '0 auto',
          padding: '24px 32px 96px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: 32,
        }}
        aria-label="Loading journal articles"
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <article
            key={i}
            style={{
              padding: 24,
              border: `1px solid ${COL.oliveSoft}`,
              borderRadius: 12,
              background: COL.creamSoft,
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <div
              className="aether-skel-pulse"
              style={{ height: 11, width: 110, borderRadius: 4 }}
            />
            <div
              className="aether-skel-pulse"
              style={{ height: 34, width: '88%', borderRadius: 6 }}
            />
            <div
              className="aether-skel-pulse"
              style={{ height: 14, width: '94%', borderRadius: 4 }}
            />
            <div
              className="aether-skel-pulse"
              style={{ height: 14, width: '78%', borderRadius: 4 }}
            />
            <div
              className="aether-skel-pulse"
              style={{ height: 14, width: '62%', borderRadius: 4 }}
            />
            <div
              className="aether-skel-pulse"
              style={{ height: 11, width: 90, borderRadius: 4, marginTop: 8 }}
            />
          </article>
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
