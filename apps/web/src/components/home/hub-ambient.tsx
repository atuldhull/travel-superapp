/**
 * HubAmbient — a calm CSS-only backdrop for /home (Phase 2, D6).
 *
 * Three soft gradient blobs drifting slowly behind the hub content.
 * Pure CSS keyframes — no JS animation loop, no canvas, no deps; the
 * `prefers-reduced-motion` query freezes the drift to a static mesh.
 *
 * Sits absolutely positioned at z=-10 inside the page, aria-hidden
 * and pointer-events-none so it never affects layout, focus, or
 * clicks. The hub's existing hero card already sits in its own
 * gradient panel; this is the subtle layer underneath everything.
 *
 * Installed for Phase 2 — Homepage hub (ambient layer).
 */
'use client';

export function HubAmbient() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{
        background:
          'radial-gradient(1200px 700px at 12% 8%, rgba(212, 175, 55, 0.06), transparent 60%),' +
          'radial-gradient(900px 600px at 88% 92%, rgba(40, 60, 130, 0.07), transparent 60%)',
      }}
    >
      {/* Three slow-drifting blobs — pure CSS keyframes below. */}
      <span className="hub-ambient-blob hub-ambient-blob--gold" />
      <span className="hub-ambient-blob hub-ambient-blob--royal" />
      <span className="hub-ambient-blob hub-ambient-blob--accent" />
      <style>{`
        .hub-ambient-blob {
          position: absolute;
          border-radius: 9999px;
          filter: blur(80px);
          opacity: 0.45;
          will-change: transform;
        }
        .hub-ambient-blob--gold {
          left: -10%; top: -8%;
          width: 42vw; height: 42vw;
          background: radial-gradient(circle, rgba(212,175,55,0.22), transparent 70%);
          animation: hub-ambient-drift-a 28s ease-in-out infinite alternate;
        }
        .hub-ambient-blob--royal {
          right: -12%; top: 30%;
          width: 38vw; height: 38vw;
          background: radial-gradient(circle, rgba(40,60,130,0.20), transparent 70%);
          animation: hub-ambient-drift-b 32s ease-in-out infinite alternate;
        }
        .hub-ambient-blob--accent {
          left: 30%; bottom: -14%;
          width: 46vw; height: 46vw;
          background: radial-gradient(circle, rgba(120,90,200,0.14), transparent 70%);
          animation: hub-ambient-drift-c 36s ease-in-out infinite alternate;
        }
        @keyframes hub-ambient-drift-a {
          from { transform: translate3d(0, 0, 0) scale(1); }
          to   { transform: translate3d(6vw, 4vh, 0) scale(1.08); }
        }
        @keyframes hub-ambient-drift-b {
          from { transform: translate3d(0, 0, 0) scale(1); }
          to   { transform: translate3d(-5vw, -6vh, 0) scale(1.05); }
        }
        @keyframes hub-ambient-drift-c {
          from { transform: translate3d(0, 0, 0) scale(1); }
          to   { transform: translate3d(-4vw, 5vh, 0) scale(1.07); }
        }
        @media (prefers-reduced-motion: reduce) {
          .hub-ambient-blob {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
