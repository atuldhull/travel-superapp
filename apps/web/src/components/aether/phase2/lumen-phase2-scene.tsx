'use client';

/**
 * AE398/AE399 — Lumen Phase 2 R3F scene. The first cut of the memory
 * studio per docs/aether/02-surfaces.md §4 Lumen.
 *
 * Composition:
 *   • A horizontal anchor rail (thin cylinder) along the X axis to read
 *     "this is the time axis"
 *   • A subtle vertical reference line at center to hint the rating axis
 *   • Per-photo plane rendered as a small `<mesh>` with a thin
 *     palette-glow border; sized + positioned via `layoutPhotoCloud`
 *
 * Until AE400 wires real image textures the planes show as solid
 * palette-glow swatches. That's an honest first-cut visual that already
 * tells the time × rating story.
 *
 * The component is the default export so the registry's
 * `mount: () => import('./lumen-phase2-scene')` can hand it directly to
 * `React.lazy`. `surface` + `phase` props arrive via `SurfaceMountProps`.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { Group, PerspectiveCamera } from 'three';
import {
  useSurfacePaletteSlots,
  useSurfaceLifecycle,
  type SurfaceMountProps,
} from '@app/aether-core';
import { lerp, lerpVec3 } from '@app/aether-canvas';
import { DEFAULT_LUMEN_LAYOUT, type LumenPlaneLayout } from './lumen-cloud';
import { useLumenData } from './lumen-data-context';
import { LumenPhotoSlot } from './lumen-photo-slot';
import { useLumenSelection } from './lumen-selection-context';
import { applyLayoutStrategy } from './lumen-strategies';
import { useLumenStrategy } from './lumen-strategy-context';
import {
  planeOpacityForFocus,
  planeScaleForFocus,
  resolveLumenCameraTarget,
} from './lumen-selection';
import { arrowDirectionFromKey, nextPhotoInDirection } from './lumen-keyboard';
import { museumArcPositions } from './lumen-museum';
import { nextFocusForPinch, wheelToPinchIntent } from './lumen-pinch';

export default function LumenPhase2Scene(
  _props: Partial<SurfaceMountProps> = {},
): React.ReactElement {
  const palette = useSurfacePaletteSlots();
  const phase = useSurfaceLifecycle();
  const { photos, isPending } = useLumenData();
  const { focusedId, setFocusedId } = useLumenSelection();
  const { strategy } = useLumenStrategy();

  // Pre-compute the photo positions once per (photo set, strategy).
  // AE410 lets the user pick the layout strategy via the arrange menu;
  // the per-frame group lerp from AE409 animates each plane to the new
  // target position so strategy swaps feel like "the wall rearranges".
  const planes = useMemo(() => applyLayoutStrategy(strategy, photos), [photos, strategy]);

  // AE409 — museum-mode arc layout when a photo is focused. The map
  // is keyed by plane id; per-frame lerping happens inside the slot.
  const museumTargets = useMemo(() => museumArcPositions(planes, focusedId), [planes, focusedId]);

  // AE402 — Esc clears the photo focus.
  // AE403 — Arrow keys step through the cloud (Left/Right walk the
  // time axis; Up/Down walk the rating axis). Both wire here.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent): void => {
      if (e.key === 'Escape' && focusedId !== null) {
        setFocusedId(null);
        return;
      }
      const dir = arrowDirectionFromKey(e.key);
      if (dir === null) return;
      // Ignore arrow keys while typing in form controls.
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName ?? '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable === true) return;
      e.preventDefault();
      const next = nextPhotoInDirection(planes, focusedId, dir);
      if (next !== null) setFocusedId(next);
    };
    window.addEventListener('keydown', onKey);
    return (): void => window.removeEventListener('keydown', onKey);
  }, [focusedId, setFocusedId, planes]);

  // AE409 — wheel-pinch focus transitions. Trackpad pinch (or
  // Ctrl+wheel) drives entry/exit of focused mode. We attach with
  // `{passive: false}` so we can preventDefault and stop browser
  // page-zoom from competing with our gesture.
  useEffect(() => {
    const onWheel = (e: globalThis.WheelEvent): void => {
      const intent = wheelToPinchIntent({ deltaY: e.deltaY, ctrlKey: e.ctrlKey });
      if (intent === null) return;
      const next = nextFocusForPinch(intent, focusedId, planes);
      if (next === undefined) return;
      e.preventDefault();
      setFocusedId(next);
    };
    window.addEventListener('wheel', onWheel, { passive: false });
    return (): void => window.removeEventListener('wheel', onWheel);
  }, [focusedId, setFocusedId, planes]);

  // While the SDK call is pending the rails alone render, so the
  // viewer sees the time axis and senses "things will appear here".
  const photosVisible = !isPending && planes.length > 0;
  // Subtle fade-in while materialising — phase 'idle' + 'materialising'
  // dim everything; 'settling' / 'listening' are at full visibility.
  const lifecycleOpacity = phase === 'idle' ? 0.25 : phase === 'materialising' ? 0.6 : 1;

  return (
    <>
      {/* Gallery lighting — soft ambient + a directional fill so the
          palette tints read cleanly without flattening the planes. */}
      <ambientLight intensity={0.55} />
      <directionalLight position={[6, 10, 8]} intensity={0.55} />

      {/* Time axis rail along X — thin cream cylinder. */}
      <mesh
        position={[0, -DEFAULT_LUMEN_LAYOUT.axisLengthY / 2 - 0.3, 0]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[0.03, 0.03, DEFAULT_LUMEN_LAYOUT.axisLengthX, 24]} />
        <meshStandardMaterial color={palette.surface} roughness={0.7} />
      </mesh>

      {/* Rating axis hint — a short vertical pillar at the centre. */}
      <mesh position={[0, 0, -0.6]}>
        <cylinderGeometry args={[0.015, 0.015, DEFAULT_LUMEN_LAYOUT.axisLengthY, 18]} />
        <meshStandardMaterial color={palette.glow} roughness={0.8} transparent opacity={0.55} />
      </mesh>

      {/* AE402 — camera driver tweens between overview + focused poses. */}
      <LumenCameraDriver focusedId={focusedId} planes={planes} />

      {/* AE401 — per-asset photo slots; AE402 click-to-focus + scale/opacity;
          AE409 wraps each slot in `<LumenAnimatedSlot>` so the plane
          lerps to its museum-arc target when something is focused. */}
      {photosVisible &&
        planes.map((p) => {
          const target = museumTargets.get(p.id) ?? p.position;
          return (
            <LumenAnimatedSlot
              key={p.id}
              plane={p}
              targetPosition={target}
              size={p.size * planeScaleForFocus(p.id, focusedId)}
              opacity={lifecycleOpacity * planeOpacityForFocus(p.id, focusedId)}
              onClick={() => setFocusedId(p.id === focusedId ? null : p.id)}
            />
          );
        })}
    </>
  );
}

/** AE409 — wraps `<LumenPhotoSlot>` with an outer group that smoothly
 *  lerps toward the supplied `targetPosition`. The slot's own group
 *  sits at the origin so it inherits the animated transform. */
function LumenAnimatedSlot({
  plane,
  targetPosition,
  size,
  opacity,
  onClick,
}: {
  readonly plane: LumenPlaneLayout;
  readonly targetPosition: readonly [number, number, number];
  readonly size: number;
  readonly opacity: number;
  readonly onClick: () => void;
}): React.ReactElement {
  const groupRef = useRef<Group>(null);
  // Capture the initial cloud position so the very first frame doesn't
  // jump — three's mesh transform stays anchored to where the plane was.
  const initialRef = useRef<[number, number, number]>([
    plane.position[0],
    plane.position[1],
    plane.position[2],
  ]);
  useFrame((_state, delta) => {
    const g = groupRef.current;
    if (g === null) return;
    const dt = Math.min(delta, 0.1);
    // Speed 4 ≈ ~250ms-to-closure; reads as "the wall arranges itself".
    const t = 1 - Math.exp(-dt * 4);
    g.position.x = lerp(g.position.x, targetPosition[0], t);
    g.position.y = lerp(g.position.y, targetPosition[1], t);
    g.position.z = lerp(g.position.z, targetPosition[2], t);
  });
  return (
    <group ref={groupRef} position={initialRef.current}>
      <LumenPhotoSlot
        assetId={plane.id}
        size={size}
        position={[0, 0, 0]}
        opacity={opacity}
        onClick={onClick}
      />
    </group>
  );
}

/** AE402 — interpolate the camera between the cloud-overview pose and
 *  the focused-photo pose. Lerp factor `1 - exp(-dt * speed)` gives a
 *  framerate-independent ease toward the target. */
function LumenCameraDriver({
  focusedId,
  planes,
}: {
  focusedId: string | null;
  planes: ReadonlyArray<import('./lumen-cloud').LumenPlaneLayout>;
}): null {
  const { camera } = useThree();
  // Hold the current eased pose in a ref so it survives re-renders.
  const posRef = useRef<[number, number, number]>([
    camera.position.x,
    camera.position.y,
    camera.position.z,
  ]);
  const lookRef = useRef<[number, number, number]>([0, 0, 0]);

  useFrame((_state, delta) => {
    const dt = Math.min(delta, 0.1);
    const target = resolveLumenCameraTarget(focusedId, planes);
    // Speed 3.5 ≈ ~280ms to closure; matches AE375's camera feel.
    const t = 1 - Math.exp(-dt * 3.5);
    const next = lerpVec3(posRef.current, target.position, t);
    posRef.current = [next[0], next[1], next[2]];
    const look = lerpVec3(lookRef.current, target.lookAt, t);
    lookRef.current = [look[0], look[1], look[2]];
    camera.position.set(next[0], next[1], next[2]);
    camera.lookAt(look[0], look[1], look[2]);
    const persp = camera as PerspectiveCamera;
    if (typeof persp.updateProjectionMatrix === 'function') {
      persp.updateProjectionMatrix();
    }
  });
  return null;
}
