/**
 * /aether/journal/[slug] — long-form article loading skeleton (AE120).
 *
 * Hero kicker + display title + dek + a long lede block + four
 * paragraph-shaped rows. Mirrors `<JournalArticle/>` shell so the
 * navigation-to-hydrate transition is layout-stable.
 */
const COL = {
  cream: '#F2E8D5',
  creamSoft: '#E9DDC2',
  ink: '#180F0B',
  terracottaDeep: '#9A4836',
  oliveSoft: '#D9DCC8',
};

export default function JournalArticleLoading(): React.ReactElement {
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
          maxWidth: 820,
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
          Journal · pulling the article
        </p>
        <div className="aether-skel-pulse" style={{ height: 64, width: '92%', borderRadius: 8 }} />
        <div
          className="aether-skel-pulse"
          style={{ height: 64, width: '70%', borderRadius: 8, marginTop: 8 }}
        />
        <div
          className="aether-skel-pulse"
          style={{ height: 16, width: '76%', borderRadius: 4, marginTop: 32 }}
        />
        <div
          className="aether-skel-pulse"
          style={{ height: 16, width: '66%', borderRadius: 4, marginTop: 8 }}
        />
      </section>

      <section
        style={{
          maxWidth: 660,
          margin: '0 auto',
          padding: '48px 32px 96px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
        aria-label="Loading article body"
      >
        {/* lede block — 7 lines */}
        {[100, 96, 92, 100, 88, 84, 70].map((w, i) => (
          <div
            key={`lede-${i}`}
            className="aether-skel-pulse"
            style={{ height: 16, width: `${w}%`, borderRadius: 4 }}
          />
        ))}
        {/* spacer pretending to be a pull-quote */}
        <div
          className="aether-skel-pulse"
          style={{ height: 56, width: '88%', borderRadius: 8, margin: '24px 0' }}
        />
        {/* second paragraph — 6 lines */}
        {[100, 98, 94, 92, 84, 60].map((w, i) => (
          <div
            key={`para-${i}`}
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
