/**
 * /aether/plan — loading skeleton (AE150).
 *
 * Form-shaped: 2 input rows + a long textarea-shape + Submit pill row.
 * Mirrors the Plan form layout so the chrome doesn't jump on hydrate.
 */
const COL = {
  cream: '#F2E8D5',
  creamSoft: '#E9DDC2',
  ink: '#180F0B',
  terracottaDeep: '#9A4836',
  oliveSoft: '#D9DCC8',
};

export default function PlanLoading(): React.ReactElement {
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
      <section style={{ maxWidth: 820, margin: '0 auto', padding: '96px 32px 32px' }}>
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
          Plan · gathering the question
        </p>
        <div className="aether-skel-pulse" style={{ height: 80, width: '78%', borderRadius: 8 }} />
      </section>

      <section
        style={{
          maxWidth: 820,
          margin: '32px auto 96px',
          padding: '0 32px',
          display: 'grid',
          gap: 24,
        }}
        aria-label="Loading plan form"
      >
        {/* 2 single-row inputs */}
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={`row-${i}`} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div
              className="aether-skel-pulse"
              style={{ height: 11, width: 130, borderRadius: 4 }}
            />
            <div
              className="aether-skel-pulse"
              style={{ height: 44, width: '100%', borderRadius: 999 }}
            />
          </div>
        ))}
        {/* textarea-shape */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="aether-skel-pulse" style={{ height: 11, width: 110, borderRadius: 4 }} />
          <div
            className="aether-skel-pulse"
            style={{ height: 140, width: '100%', borderRadius: 12 }}
          />
        </div>
        {/* submit row */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <div
            className="aether-skel-pulse"
            style={{ height: 44, width: 120, borderRadius: 999 }}
          />
          <div
            className="aether-skel-pulse"
            style={{ height: 44, width: 160, borderRadius: 999 }}
          />
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
