'use client';

/**
 * Atlas Phase 1 surface scene — R3F default export consumed by
 * `Surface.mount` (the atlas surface registered in `aether-registry.ts`).
 *
 * Composition (AE378 first cut):
 *   • Timeline rail   — thin terracotta cylinder along the X axis.
 *   • Day markers     — small ochre cylinders along the rail, one per day.
 *   • PlaceOrbs       — small spheres, one per itinerary item, positioned
 *                       via `layoutOrbsForTrip` (X = day on axis, Z =
 *                       within-day stack slot, Y = on the plane).
 *   • Ambient field   — inherits from the global SurfaceCanvas wrapper
 *                       (the shell renders `<AmbientField/>` outside the
 *                       scene so it persists across surface switches).
 *
 * AE378 keeps the scene read-only. Drag interactions, physics-based orb
 * dropping, weather-driven shaders all land in later AE prompts.
 *
 * Data: `useTripData()` from `trip-data-context.tsx`. While the SDK
 * request is pending the scene shows nothing (the SurfaceCanvas
 * placeholder + Suspense fallback handle the visual). When the trip
 * has no itinerary days yet, only the rail renders.
 */
import { useTheme } from '@app/aether-core';
import type { SurfaceMountProps } from '@app/aether-core';
import {
  DEFAULT_ATLAS_LAYOUT,
  layoutDayMarkers,
  layoutOrbsForTrip,
  orbColorForItem,
  orbSizeForItem,
} from './atlas-orbs';
import { useTripData } from './trip-data-context';

export default function AtlasPhase1Scene(_props: SurfaceMountProps): React.ReactElement {
  const theme = useTheme();
  const { days, isPending } = useTripData();

  // Hide everything while we don't yet have data — the SurfaceCanvas
  // outer placeholder owns the loading visual.
  if (isPending) return <></>;

  const orbs = layoutOrbsForTrip(days, DEFAULT_ATLAS_LAYOUT);
  const markers = layoutDayMarkers(days, DEFAULT_ATLAS_LAYOUT);

  const railColor = theme.palette.terracotta.deep ?? theme.palette.terracotta.base;
  const markerColor = theme.palette.ochre.glow;
  const orbAccent = theme.palette.ochre.glow;

  return (
    <>
      {/* Timeline rail — rotated cylinder along the X axis (default
          cylinder runs along Y, so rotate 90deg about Z). */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.025, 0.025, DEFAULT_ATLAS_LAYOUT.axisLength, 12]} />
        <meshStandardMaterial color={railColor} roughness={0.6} metalness={0.05} />
      </mesh>

      {/* Day markers — small ochre disks under the rail. */}
      {markers.map((m) => (
        <mesh key={`day-${m.dayIndex}`} position={[m.x, -0.1, 0]}>
          <cylinderGeometry args={[0.12, 0.12, 0.04, 16]} />
          <meshStandardMaterial color={markerColor} roughness={0.5} />
        </mesh>
      ))}

      {/* PlaceOrbs — one sphere per itinerary item. */}
      {orbs.map((o) => (
        <mesh key={`orb-${o.id}`} position={[o.x, o.y + 0.3, o.z]}>
          <sphereGeometry
            args={[
              orbSizeForItem({ id: o.id, position: o.itemPosition, placeId: o.placeId }),
              24,
              24,
            ]}
          />
          <meshStandardMaterial
            color={orbColorForItem(
              { id: o.id, position: o.itemPosition, placeId: o.placeId },
              orbAccent,
            )}
            roughness={0.45}
            metalness={0.1}
          />
        </mesh>
      ))}
    </>
  );
}
