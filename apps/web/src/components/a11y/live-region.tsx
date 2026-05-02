/**
 * V.UX.28 — visually-hidden ARIA live region pair. Mounted once in the
 * root layout; consumers push messages via `announce()` from
 * `lib/announce.ts`. Two regions (polite + assertive) so consumers
 * can pick the right interruption posture.
 *
 * `sr-only` (via inline styles since this is a 'use client' island
 * outside the Tailwind-aware tree) hides the regions from sighted
 * users without removing them from the accessibility tree.
 *
 * Installed by prompt [V.UX.28].
 */
'use client';

const SR_ONLY: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
};

export function LiveRegion() {
  return (
    <>
      <div
        id="a11y-live-polite"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={SR_ONLY}
      />
      <div
        id="a11y-live-assertive"
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        style={SR_ONLY}
      />
    </>
  );
}
