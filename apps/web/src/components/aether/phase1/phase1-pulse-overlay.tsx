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
import { usePulseHoldToTalk } from '../phase2/use-pulse-hold-to-talk';
import { holdStatusLabel } from '../phase2/pulse-hold-to-talk';

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
  /** AE416 — hold-to-talk handler. When set, a press longer than the
   *  AE416 threshold (`PULSE_HOLD_THRESHOLD_MS`) fires this; a
   *  sub-threshold tap still fires `onActivate`. Phase 2 shells wire
   *  this to open the Genie modal. */
  readonly onHoldOpen?: () => void;
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
  onHoldOpen,
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
      onHoldOpen={onHoldOpen}
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
  onHoldOpen,
  children,
}: {
  corner: NonNullable<Phase1PulseOverlayProps['corner']>;
  mood?: PulseMood;
  disableCanvas: boolean;
  label?: string;
  onActivate?: () => void;
  onHoldOpen?: () => void;
  children: ReactNode;
}): React.ReactElement {
  // AE416 — hold-to-talk gesture. When `onHoldOpen` is set the hook
  // captures the press/release pair; sub-threshold taps still fall
  // through to `onActivate`. When `onHoldOpen` is undefined the
  // overlay behaves as before (plain click handler).
  const hold = usePulseHoldToTalk({
    onTap: onActivate,
    onHold: onHoldOpen,
  });
  const isHolding = hold.status === 'holding';
  const interactive = onActivate !== undefined || onHoldOpen !== undefined;
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
    cursor: interactive ? 'pointer' : 'default',
    // AE416 — soft scale-up while the user is past the hold threshold
    // so the gesture has a visible "almost there" beat.
    transform: isHolding ? 'scale(1.18)' : 'scale(1)',
    transition: 'transform 220ms ease, box-shadow 220ms ease',
    boxShadow: isHolding ? '0 0 32px var(--aether-palette-glow, #E8B777)' : 'none',
    ...CORNER_STYLES[corner],
  };
  // Pick the click handler: when `onHoldOpen` is set we let the
  // pointer-down/up pair drive the tap/hold split via the hook so the
  // bare onClick stays a no-op (would double-fire).
  const clickHandler = onHoldOpen !== undefined ? undefined : onActivate;
  return (
    <div
      role={interactive ? 'button' : 'presentation'}
      tabIndex={interactive ? 0 : -1}
      aria-label={label}
      data-aether-pulse-overlay
      data-aether-pulse-corner={corner}
      data-aether-pulse-hold-status={hold.status}
      style={containerStyle}
      onClick={clickHandler}
      onPointerDown={onHoldOpen !== undefined ? hold.onPointerDown : undefined}
      onPointerUp={onHoldOpen !== undefined ? hold.onPointerUp : undefined}
      onPointerLeave={onHoldOpen !== undefined ? hold.onPointerLeave : undefined}
      onPointerCancel={onHoldOpen !== undefined ? hold.onPointerCancel : undefined}
      onKeyDown={(e) => {
        if (!interactive) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onActivate?.();
        }
      }}
    >
      {children}
      {/* AE416 — sr-only hold-status announcer. */}
      {onHoldOpen !== undefined && (
        <span
          role="status"
          aria-live="polite"
          data-aether-pulse-hold-aria
          style={{
            position: 'absolute',
            width: 1,
            height: 1,
            padding: 0,
            margin: -1,
            overflow: 'hidden',
            clip: 'rect(0,0,0,0)',
            whiteSpace: 'nowrap',
            border: 0,
          }}
        >
          {holdStatusLabel(hold.status)}
        </span>
      )}
    </div>
  );
}

/** Standalone shell — does NOT call `useSurfaceManager()`, so it can be
 *  rendered in Storybook / docs without wiring the provider. The mood
 *  must be explicit. */
export function Phase1PulseOverlayStandalone(
  props: Phase1PulseOverlayProps & { mood: PulseMood },
): React.ReactElement {
  const {
    corner = 'bottom-right',
    mood,
    disableCanvas = false,
    label,
    onActivate,
    onHoldOpen,
  } = props;
  return (
    <Phase1PulseOverlayShell
      corner={corner}
      mood={mood}
      disableCanvas={disableCanvas}
      label={label}
      onActivate={onActivate}
      onHoldOpen={onHoldOpen}
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
