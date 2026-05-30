/**
 * /aether/account — loading skeleton (AE125).
 *
 * Identity definition list + 4 setting groups (audio / motion /
 * privacy / sign-out).
 */
const COL = {
  cream: '#F2E8D5',
  creamSoft: '#E9DDC2',
  ink: '#180F0B',
  terracottaDeep: '#9A4836',
  oliveSoft: '#D9DCC8',
};

export default function AccountLoading(): React.ReactElement {
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
          Account · gathering you
        </p>
        <div className="aether-skel-pulse" style={{ height: 72, width: '64%', borderRadius: 8 }} />
      </section>

      {/* identity DL */}
      <section
        style={{
          maxWidth: 820,
          margin: '32px auto 0',
          padding: '0 32px',
        }}
        aria-label="Loading identity"
      >
        <div
          style={{
            padding: 24,
            borderRadius: 12,
            border: `1px solid ${COL.oliveSoft}`,
            background: COL.creamSoft,
            display: 'grid',
            gridTemplateColumns: '120px 1fr',
            rowGap: 14,
            columnGap: 16,
            alignItems: 'center',
          }}
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ display: 'contents' }}>
              <div
                className="aether-skel-pulse"
                style={{ height: 11, width: 80, borderRadius: 4 }}
              />
              <div
                className="aether-skel-pulse"
                style={{ height: 16, width: '70%', borderRadius: 4 }}
              />
            </div>
          ))}
        </div>
      </section>

      {/* 4 settings groups */}
      <section
        style={{
          maxWidth: 820,
          margin: '32px auto 0',
          padding: '0 32px 96px',
          display: 'grid',
          gap: 16,
        }}
        aria-label="Loading settings groups"
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            style={{
              padding: 20,
              borderRadius: 12,
              border: `1px solid ${COL.oliveSoft}`,
              background: COL.creamSoft,
            }}
          >
            <div
              className="aether-skel-pulse"
              style={{ height: 22, width: '40%', borderRadius: 6 }}
            />
            <div
              className="aether-skel-pulse"
              style={{ height: 14, width: '80%', borderRadius: 4, marginTop: 12 }}
            />
            <div
              className="aether-skel-pulse"
              style={{ height: 34, width: 130, borderRadius: 999, marginTop: 16 }}
            />
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
