/**
 * /aether/onboarding — loading skeleton (AE150).
 *
 * Three-beat shape (the AE46 first-time welcome): centered hero +
 * three editorial cards (numbered) + a continue pill row.
 */
const COL = {
  cream: '#F2E8D5',
  creamSoft: '#E9DDC2',
  ink: '#180F0B',
  terracottaDeep: '#9A4836',
  oliveSoft: '#D9DCC8',
};

export default function OnboardingLoading(): React.ReactElement {
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
          maxWidth: 760,
          margin: '0 auto',
          padding: '96px 32px 32px',
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
          Welcome · loading
        </p>
        <div
          className="aether-skel-pulse"
          style={{ height: 80, width: '88%', margin: '0 auto', borderRadius: 8 }}
        />
        <div
          className="aether-skel-pulse"
          style={{ height: 16, width: '64%', margin: '32px auto 0', borderRadius: 4 }}
        />
      </section>

      <section
        style={{
          maxWidth: 1080,
          margin: '48px auto 0',
          padding: '0 32px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 24,
        }}
        aria-label="Loading welcome beats"
      >
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            style={{
              minHeight: 220,
              padding: 28,
              borderRadius: 12,
              background: COL.creamSoft,
              border: `1px solid ${COL.oliveSoft}`,
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <div
              className="aether-skel-pulse"
              style={{ height: 24, width: 40, borderRadius: 999 }}
            />
            <div
              className="aether-skel-pulse"
              style={{ height: 28, width: '78%', borderRadius: 6 }}
            />
            <div
              className="aether-skel-pulse"
              style={{ height: 14, width: '94%', borderRadius: 4 }}
            />
            <div
              className="aether-skel-pulse"
              style={{ height: 14, width: '88%', borderRadius: 4 }}
            />
            <div
              className="aether-skel-pulse"
              style={{ height: 14, width: '70%', borderRadius: 4 }}
            />
          </div>
        ))}
      </section>

      <section
        style={{
          maxWidth: 760,
          margin: '48px auto 96px',
          padding: '0 32px',
          display: 'flex',
          justifyContent: 'center',
          gap: 12,
        }}
        aria-label="Loading continue row"
      >
        <div className="aether-skel-pulse" style={{ height: 44, width: 180, borderRadius: 999 }} />
        <div className="aether-skel-pulse" style={{ height: 44, width: 110, borderRadius: 999 }} />
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
