/**
 * /aether/feed — loading skeleton (AE447).
 *
 * The Echo feed is a vertical-scroll TikTok-style stream of textured
 * planes. Before the R3F canvas hydrates the surface, paint a single
 * tall card placeholder + a right-edge action column so layout doesn't
 * jump when the WebGL canvas mounts.
 *
 * Inverted theme: dark ink background (matches Echo's photo-first
 * frame), cream shimmer for the contrast.
 */
const COL = {
  ink: '#1A0F09',
  inkSoft: '#2A1A12',
  surface: '#F2E8D5',
  surfaceSoft: '#E9DDC2',
};

export default function FeedLoading(): React.ReactElement {
  return (
    <div
      style={{
        background: COL.ink,
        color: COL.surface,
        minHeight: '100vh',
        fontFamily: 'var(--font-inter), system-ui, -apple-system, sans-serif',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
      }}
      aria-busy="true"
      aria-live="polite"
      aria-label="Loading Echo feed"
    >
      <div
        style={{
          position: 'relative',
          width: 'min(460px, 92vw)',
          height: 'min(640px, 92vh)',
          borderRadius: 22,
          overflow: 'hidden',
          background: COL.inkSoft,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
        }}
        aria-label="Loading echo card"
      >
        {/* Photo placeholder */}
        <div className="aether-feed-skel-pulse" style={{ position: 'absolute', inset: 0 }} />

        {/* Diary text block */}
        <div
          style={{
            position: 'absolute',
            bottom: 24,
            left: 24,
            right: 80,
            padding: '18px 22px',
            borderRadius: 18,
            background: 'rgba(20, 12, 8, 0.55)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div
            className="aether-feed-skel-pulse"
            style={{ height: 11, width: 200, borderRadius: 4 }}
          />
          <div
            className="aether-feed-skel-pulse"
            style={{ height: 18, width: '92%', borderRadius: 4 }}
          />
          <div
            className="aether-feed-skel-pulse"
            style={{ height: 18, width: '74%', borderRadius: 4 }}
          />
        </div>

        {/* Right-edge action column */}
        <nav
          style={{
            position: 'absolute',
            right: 16,
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
          aria-label="Loading actions"
        >
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="aether-feed-skel-pulse"
              style={{ width: 44, height: 44, borderRadius: '50%' }}
            />
          ))}
        </nav>
      </div>

      <style>{`
        .aether-feed-skel-pulse {
          background: linear-gradient(
            90deg,
            ${COL.inkSoft} 0%,
            rgba(242, 232, 213, 0.18) 50%,
            ${COL.inkSoft} 100%
          );
          background-size: 200% 100%;
          animation: aether-feed-skel-shimmer 1.6s ease-in-out infinite;
        }
        @keyframes aether-feed-skel-shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .aether-feed-skel-pulse {
            animation: none;
            background: ${COL.inkSoft};
          }
        }
      `}</style>
    </div>
  );
}
