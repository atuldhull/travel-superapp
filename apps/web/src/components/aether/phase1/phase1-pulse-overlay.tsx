'use client';

/**
 * `<Phase1PulseOverlay>` — the fixed-position 60-pixel corner glow that
 * houses the Pulse Phase 1 scene.
 *
 * Per docs/aether/02-surfaces.md §7 the Pulse is "always-present" — it
 * sits in the corner of every surface, not inside the surface's main
 * canvas. We honour that by owning a small 64×64 `<div>` with its own
 * tiny `<Canvas>` rather than threading the Pulse scene through the
 * route-bound `<SurfaceCanvas>` (which is reserved for the active
 * route's scene).
 *
 * The overlay only renders when the SurfaceManager registry includes a
 * 'pulse' overlay surface — that keeps the contract honest: the shell
 * mounts `<Phase1PulseOverlay>` unconditionally, but a registry without
 * Pulse silently skips it.
 *
 * Implementation note (jsdom-friendly): the `<Canvas>` import is
 * lazy-loaded so test environments can render the outer `<div>` (assert
 * presence, position, aria) without paying R3F's WebGL bootstrap cost.
 * The `disableCanvas` prop is the explicit Storybook / test override.
 */
import { Suspense, lazy, useMemo, type CSSProperties, type ReactNode } from 'react';
import { useSurfaceManager } from '@app/aether-core';
import type { PulseMood } from './pulse-breathing';

/** R3F Canvas lazy-loaded so tests can mount the outer overlay without
 *  the WebGL bootstrap. The Canvas chunk only downloads in the browser
 *  on the actual route (Phase 1 flag on). */
const LazyCanvas = lazy(async () => {
  const mod = await import('@react-three/fiber');
  return { default: mod.Canvas };
});

const LazyPulseScene = lazy(() => import('./pulse-phase1-scene'));

export interface Phase1PulseOverlayProps {
  /** Corner placement. Defaults to bottom-right per the design (`60
   *  pixel soft glow in the corner of every surface`). */
  readonly corner?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  /** Override the auto-derived mood. Tests + Storybook pin this. */
  readonly mood?: PulseMood;
  /** Skip the R3F `<Canvas>` mount — used by jsdom tests to verify the
   *  outer overlay container renders without paying R3F's cost. */
  readonly disableCanvas?: boolean;
  /** Hide the overlay (e.g. on a surface where Pulse should hibernate). */
  readonly hidden?: boolean;
  /** Optional aria-label override. Defaults to "Aether Pulse — always-on AI". */
  readonly label?: string;
  /** Optional click handler. Phase 2 wires Genie (hold-to-talk); Phase 1
   *  first cut just exposes the slot so the existing AE96 Pulse FAB can
   *  be reached. */
  readonly onActivate?: () => void;
}

const CORNER_STYLES: Record<NonNullable<Phase1PulseOverlayProps['corner']>, CSSProperties> = {
  'bottom-right': { right: 24, bottom: 24 },
  'bottom-left': { left: 24, bottom: 24 },
  'top-right': { right: 24, top: 24 },
  'top-left': { left: 24, top: 24 },
};

const SIZE_PX = 64;

/** Inner — renders only when manager.overlays contains 'pulse'. Split
 *  out so callers outside a SurfaceManagerProvider (Storybook with a
 *  manual mood prop) can still mount via `<Phase1PulseOverlayStandalone>`. */
function Phase1PulseOverlayInner({
  corner = 'bottom-right',
  mood,
  disableCanvas = false,
  hidden = false,
  label = 'Aether Pulse — always-on AI',
  onActivate,
}: Phase1PulseOverlayProps): React.ReactElement | null {
  const manager = useSurfaceManager();
  const hasPulse = useMemo(
    () => manager.overlays.some((o) => o.id === 'pulse'),
    [manager.overlays],
  );
  if (!hasPulse || hidden) return null;
  return (
    <Phase1PulseOverlayShell
      corner={corner}
      mood={mood}
      disableCanvas={disableCanvas}
      label={label}
      onActivate={onActivate}
    >
      {disableCanvas ? null : (
        <Suspense fallback={null}>
          <LazyCanvas
            // Small camera frames the radius-1 sphere comfortably.
            camera={{ position: [0, 0, 3], fov: 50 }}
            // The Pulse canvas should not steal scrolls / pointer events
            // away from the underlying surface — disable raycasting.
            dpr={[1, 2]}
            gl={{ alpha: true, antialias: true }}
            style={{ width: '100%', height: '100%' }}
          >
            <Suspense fallback={null}>
              <LazyPulseScene {...(mood !== undefined ? { mood } : {})} />
            </Suspense>
          </LazyCanvas>
        </Suspense>
      )}
    </Phase1PulseOverlayShell>
  );
}

/** Visual shell — the fixed-position div + click target. Pure DOM, no
 *  manager hooks, so it can be reused by Storybook fixtures. */
function Phase1PulseOverlayShell({
  corner = 'bottom-right',
  label,
  onActivate,
  children,
}: {
  corner: NonNullable<Phase1PulseOverlayProps['corner']>;
  mood?: PulseMood;
  disableCanvas: boolean;
  label?: string;
  onActivate?: () => void;
  children: ReactNode;
}): React.ReactElement {
  const containerStyle: CSSProperties = {
    position: 'fixed',
    width: SIZE_PX,
    height: SIZE_PX,
    borderRadius: '50%',
    zIndex: 12,
    // Pointer events stay on so the AE96 Genie-handoff target can sit
    // here; the underlying canvas itself doesn't intercept anything
    // since R3F's <Canvas> covers the whole bounding box.
    pointerEvents: 'auto',
    background: 'transparent',
    overflow: 'hidden',
    cursor: onActivate !== undefined ? 'pointer' : 'default',
    ...CORNER_STYLES[corner],
  };
  return (
    <div
      role={onActivate !== undefined ? 'button' : 'presentation'}
      tabIndex={onActivate !== undefined ? 0 : -1}
      aria-label={label}
      data-aether-pulse-overlay
      data-aether-pulse-corner={corner}
      style={containerStyle}
      onClick={onActivate}
      onKeyDown={(e) => {
        if (onActivate === undefined) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onActivate();
        }
      }}
    >
      {children}
    </div>
  );
}

/** Standalone shell — does NOT call `useSurfaceManager()`, so it can be
 *  rendered in Storybook / docs without wiring the provider. The mood
 *  must be explicit. */
export function Phase1PulseOverlayStandalone(
  props: Phase1PulseOverlayProps & { mood: PulseMood },
): React.ReactElement {
  const { corner = 'bottom-right', mood, disableCanvas = false, label, onActivate } = props;
  return (
    <Phase1PulseOverlayShell
      corner={corner}
      mood={mood}
      disableCanvas={disableCanvas}
      label={label}
      onActivate={onActivate}
    >
      {disableCanvas ? null : (
        <Suspense fallback={null}>
          <LazyCanvas
            camera={{ position: [0, 0, 3], fov: 50 }}
            dpr={[1, 2]}
            gl={{ alpha: true, antialias: true }}
            style={{ width: '100%', height: '100%' }}
          >
            <Suspense fallback={null}>
              <LazyPulseScene mood={mood} />
            </Suspense>
          </LazyCanvas>
        </Suspense>
      )}
    </Phase1PulseOverlayShell>
  );
}

export function Phase1PulseOverlay(props: Phase1PulseOverlayProps): React.ReactElement | null {
  return <Phase1PulseOverlayInner {...props} />;
}
