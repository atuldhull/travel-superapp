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
import { useMemo } from 'react';
import {
  useSurfacePaletteSlots,
  useSurfaceLifecycle,
  type SurfaceMountProps,
} from '@app/aether-core';
import { DEFAULT_LUMEN_LAYOUT, layoutPhotoCloud } from './lumen-cloud';
import { useLumenData } from './lumen-data-context';
import { LumenPhotoSlot } from './lumen-photo-slot';

export default function LumenPhase2Scene(_props: SurfaceMountProps): React.ReactElement {
  const palette = useSurfacePaletteSlots();
  const phase = useSurfaceLifecycle();
  const { photos, isPending } = useLumenData();

  // Pre-compute the photo positions once per photo set.
  const planes = useMemo(() => layoutPhotoCloud(photos), [photos]);

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

      {/* AE401 — per-asset photo slots. Each slot owns its own
          `useMediaControllerDownloadUrl(assetId)` query and renders
          `<PhotoPlane>` with the resolved presigned URL; the plane
          shows its palette-glow fallback until the texture loads, so
          the cloud reads "alive" while individual photos resolve. */}
      {photosVisible &&
        planes.map((p) => (
          <LumenPhotoSlot
            key={p.id}
            assetId={p.id}
            size={p.size}
            position={p.position}
            opacity={lifecycleOpacity}
          />
        ))}
    </>
  );
}
