/**
 * /aether/about — loading skeleton (AE150).
 *
 * Centered manifesto shape: kicker, hero title, lead paragraph, then
 * five short paragraphs (the manifesto body). The cream shimmer +
 * reduced-motion fallback match AE115's pattern.
 */
const COL = {
  cream: '#F2E8D5',
  creamSoft: '#E9DDC2',
  ink: '#180F0B',
  terracottaDeep: '#9A4836',
  oliveSoft: '#D9DCC8',
};

export default function AboutLoading(): React.ReactElement {
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
          About · loading the manifesto
        </p>
        <div
          className="aether-skel-pulse"
          style={{ height: 80, width: '85%', margin: '0 auto', borderRadius: 8 }}
        />
        <div
          className="aether-skel-pulse"
          style={{ height: 80, width: '60%', margin: '8px auto 0', borderRadius: 8 }}
        />
      </section>

      <section
        style={{
          maxWidth: 640,
          margin: '0 auto',
          padding: '48px 32px 96px',
          display: 'flex',
          flexDirection: 'column',
          gap: 28,
        }}
        aria-label="Loading manifesto body"
      >
        {[5, 6, 6, 5, 4].map((rows, i) => (
          <div key={`p-${i}`} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Array.from({ length: rows }).map((_, j) => (
              <div
                key={j}
                className="aether-skel-pulse"
                style={{
                  height: 16,
                  width: `${88 - j * 6}%`,
                  borderRadius: 4,
                }}
              />
            ))}
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
