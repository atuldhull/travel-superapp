/**
 * /aether/vault — loading skeleton (AE464).
 *
 * Vault is the Phase 2 bookings + commerce surface where prices float
 * as weighted glyphs in a 3D ring (R3F canvas). Before the canvas
 * hydrates, paint a centred ring of 8 placeholder glyph circles plus
 * faint price-tag chips so layout doesn't jump when the WebGL mounts.
 *
 * Inverted ink theme — consistent with the Vault scene background.
 */
const COL = {
  ink: '#1A0F09',
  inkSoft: '#241510',
  glow: '#E8B777',
  accent: '#C44536',
  surface: '#F2E8D5',
};

const RING_RADIUS = 150;
const GLYPH_COUNT = 8;

export default function VaultLoading(): React.ReactElement {
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
      aria-label="Loading Vault"
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
        aria-label="Loading vault badge"
      >
        <div
          className="aether-vault-skel-pulse"
          style={{ height: 11, width: 120, borderRadius: 4 }}
        />
        <div
          className="aether-vault-skel-pulse"
          style={{ height: 18, width: 180, borderRadius: 4 }}
        />
      </div>

      {/* Centre ring of floating glyphs */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: RING_RADIUS * 2 + 80,
          height: RING_RADIUS * 2 + 80,
        }}
        aria-label="Loading price ring"
      >
        {/* Inner faint ring outline */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: RING_RADIUS * 2,
            height: RING_RADIUS * 2,
            borderRadius: '50%',
            border: `1px dashed rgba(232, 183, 119, 0.18)`,
          }}
          aria-hidden
        />

        {Array.from({ length: GLYPH_COUNT }).map((_, i) => {
          const angle = (i / GLYPH_COUNT) * Math.PI * 2 - Math.PI / 2;
          const x = Math.cos(angle) * RING_RADIUS;
          const y = Math.sin(angle) * RING_RADIUS;
          const size = 48 + (i % 3) * 8;
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                width: size,
                height: size,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <div
                className="aether-vault-skel-pulse"
                style={{
                  width: size,
                  height: size,
                  borderRadius: '50%',
                  boxShadow: `0 0 24px rgba(232, 183, 119, 0.12)`,
                }}
              />
              <div
                className="aether-vault-skel-pulse"
                style={{
                  height: 10,
                  width: size - 8,
                  borderRadius: 3,
                  marginTop: 2,
                }}
              />
            </div>
          );
        })}

        {/* Centre total chip */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <div
            className="aether-vault-skel-pulse"
            style={{ height: 11, width: 60, borderRadius: 4 }}
          />
          <div
            className="aether-vault-skel-pulse"
            style={{ height: 22, width: 90, borderRadius: 4 }}
          />
        </div>
      </div>

      {/* Bottom checkout panel placeholder */}
      <div
        style={{
          position: 'absolute',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'min(420px, 92vw)',
          padding: '16px 20px',
          borderRadius: 14,
          background: COL.inkSoft,
          border: `1px solid rgba(232, 183, 119, 0.18)`,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
        aria-label="Loading checkout panel"
      >
        <div
          className="aether-vault-skel-pulse"
          style={{ height: 12, width: 140, borderRadius: 4 }}
        />
        <div
          className="aether-vault-skel-pulse"
          style={{ height: 36, width: '100%', borderRadius: 8 }}
        />
      </div>

      <style>{`
        .aether-vault-skel-pulse {
          background: linear-gradient(
            90deg,
            ${COL.inkSoft} 0%,
            rgba(232, 183, 119, 0.18) 50%,
            ${COL.inkSoft} 100%
          );
          background-size: 200% 100%;
          animation: aether-vault-skel-shimmer 1.6s ease-in-out infinite;
        }
        @keyframes aether-vault-skel-shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .aether-vault-skel-pulse {
            animation: none;
            background: ${COL.inkSoft};
          }
        }
      `}</style>
    </div>
  );
}
