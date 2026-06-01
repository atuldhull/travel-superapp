/**
 * /aether/memory/[id] — loading skeleton (AE464).
 *
 * Lumen is the Phase 2 memory studio where photos float in a 3D
 * cloud sorted by time + rating (R3F canvas). Before the canvas
 * hydrates, paint a scattered cloud of 8 photo-plane placeholders
 * across a cloud-like grid so layout doesn't jump when the WebGL
 * mounts.
 *
 * Inverted ink theme — Lumen scene reads photo-first against the
 * dark frame.
 */
const COL = {
  ink: '#1A0F09',
  inkSoft: '#241510',
  glow: '#E8B777',
  surface: '#F2E8D5',
};

// Scattered placeholder positions for a cloud-like grid (percent of frame).
// Each plane has a slight rotation to evoke the floating 3D look.
const PLANES: ReadonlyArray<{
  top: string;
  left: string;
  width: number;
  height: number;
  rotate: number;
  opacity: number;
}> = [
  { top: '14%', left: '10%', width: 160, height: 110, rotate: -6, opacity: 0.9 },
  { top: '22%', left: '38%', width: 200, height: 140, rotate: 3, opacity: 1 },
  { top: '12%', left: '68%', width: 150, height: 105, rotate: 7, opacity: 0.85 },
  { top: '46%', left: '20%', width: 180, height: 125, rotate: -3, opacity: 0.92 },
  { top: '52%', left: '52%', width: 170, height: 118, rotate: 5, opacity: 0.88 },
  { top: '58%', left: '78%', width: 130, height: 90, rotate: -8, opacity: 0.8 },
  { top: '74%', left: '32%', width: 140, height: 96, rotate: 4, opacity: 0.82 },
  { top: '70%', left: '62%', width: 160, height: 110, rotate: -2, opacity: 0.86 },
];

export default function MemoryLoading(): React.ReactElement {
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
      aria-label="Loading Lumen memory studio"
    >
      {/* Top-left book/photo-count badge */}
      <div
        style={{
          position: 'absolute',
          top: 24,
          left: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          zIndex: 2,
        }}
        aria-label="Loading memory badge"
      >
        <div className="aether-skel" style={{ height: 11, width: 140, borderRadius: 4 }} />
        <div className="aether-skel" style={{ height: 18, width: 220, borderRadius: 4 }} />
      </div>

      {/* Photo-plane cloud */}
      <div style={{ position: 'absolute', inset: 0 }} aria-label="Loading photo cloud">
        {PLANES.map((p, i) => (
          <div
            key={i}
            className="aether-skel"
            style={{
              position: 'absolute',
              top: p.top,
              left: p.left,
              width: p.width,
              height: p.height,
              borderRadius: 6,
              transform: `rotate(${p.rotate}deg)`,
              opacity: p.opacity,
              boxShadow: '0 6px 20px rgba(0, 0, 0, 0.5)',
              border: `1px solid rgba(242, 232, 213, 0.06)`,
            }}
          />
        ))}
      </div>

      {/* Bottom-centre arrange-menu hint placeholder */}
      <div
        style={{
          position: 'absolute',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: 8,
          zIndex: 2,
        }}
        aria-label="Loading arrange menu"
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="aether-skel"
            style={{ height: 28, width: 78, borderRadius: 14 }}
          />
        ))}
      </div>

      <style>{`
        .aether-skel {
          background: linear-gradient(
            90deg,
            ${COL.inkSoft} 0%,
            rgba(242, 232, 213, 0.16) 50%,
            ${COL.inkSoft} 100%
          );
          background-size: 200% 100%;
          animation: aether-memory-skel-shimmer 1.6s ease-in-out infinite;
        }
        @keyframes aether-memory-skel-shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .aether-skel {
            animation: none;
            background: ${COL.inkSoft};
          }
        }
      `}</style>
    </div>
  );
}
