/**
 * /aether/mirror — loading skeleton (AE448).
 *
 * The Mirror admin surface mounts a translucent globe + audit-river
 * overlay + Cmd+K palette. Before the R3F canvas hydrates, paint a
 * centred globe placeholder + a right-edge audit-river column so
 * layout doesn't jump when the WebGL mounts.
 *
 * Inverted ink theme — operator surface stays distinct from the
 * editorial cream pages.
 */
const COL = {
  ink: '#1A0F09',
  inkSoft: '#241510',
  glow: '#E8B777',
  support: '#6E7B5C',
  surface: '#F2E8D5',
};

export default function MirrorLoading(): React.ReactElement {
  return (
    <div
      style={{
        background: COL.ink,
        color: COL.surface,
        minHeight: '100vh',
        fontFamily: 'var(--font-inter), system-ui, -apple-system, sans-serif',
        position: 'relative',
        overflow: 'hidden',
      }}
      aria-busy="true"
      aria-live="polite"
      aria-label="Loading Mirror admin"
    >
      {/* Top-left badge placeholder */}
      <div
        style={{
          position: 'absolute',
          top: 24,
          left: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
        aria-label="Loading admin badge"
      >
        <div
          className="aether-mirror-skel-pulse"
          style={{ height: 11, width: 140, borderRadius: 4 }}
        />
        <div
          className="aether-mirror-skel-pulse"
          style={{ height: 18, width: 220, borderRadius: 4 }}
        />
      </div>

      {/* Centre globe placeholder */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }}
        aria-label="Loading globe"
      >
        <div
          className="aether-mirror-skel-pulse"
          style={{
            width: 340,
            height: 340,
            borderRadius: '50%',
            border: `1px solid ${COL.support}55`,
            boxShadow: `0 0 64px rgba(232, 183, 119, 0.18)`,
          }}
        />
      </div>

      {/* Right-edge audit river placeholder */}
      <aside
        style={{
          position: 'absolute',
          top: 32,
          right: 24,
          width: 220,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
        aria-label="Loading audit river"
      >
        <div
          className="aether-mirror-skel-pulse"
          style={{ height: 11, width: 120, borderRadius: 4 }}
        />
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              opacity: 1 - i * 0.08,
            }}
          >
            <div
              className="aether-mirror-skel-pulse"
              style={{ width: 8, height: 8, borderRadius: '50%' }}
            />
            <div
              className="aether-mirror-skel-pulse"
              style={{
                height: 11,
                flex: 1,
                borderRadius: 3,
              }}
            />
          </div>
        ))}
      </aside>

      {/* Cmd+K hint */}
      <div
        style={{
          position: 'absolute',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: 11,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          opacity: 0.45,
        }}
        aria-hidden
      >
        ⌘ K · investigate user
      </div>

      <style>{`
        .aether-mirror-skel-pulse {
          background: linear-gradient(
            90deg,
            ${COL.inkSoft} 0%,
            rgba(232, 183, 119, 0.16) 50%,
            ${COL.inkSoft} 100%
          );
          background-size: 200% 100%;
          animation: aether-mirror-skel-shimmer 1.6s ease-in-out infinite;
        }
        @keyframes aether-mirror-skel-shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .aether-mirror-skel-pulse {
            animation: none;
            background: ${COL.inkSoft};
          }
        }
      `}</style>
    </div>
  );
}
