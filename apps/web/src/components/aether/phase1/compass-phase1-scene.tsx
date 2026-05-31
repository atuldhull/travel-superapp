'use client';

/**
 * Compass Phase 1 surface scene — R3F default export consumed by
 * `Surface.mount`. AE379 first cut:
 *   • Compass rose disc (large cream-coloured flat cylinder)
 *   • Four cardinal direction markers (small ochre orbs at the
 *     compass-rose perimeter)
 *   • Glowing terracotta needle pointing toward `bearing` (default 0°
 *     = North)
 *   • A subtle altitude ring (thin cylinder above the rose) for the
 *     "you are flying overhead" feel
 *
 * The bearing comes from props (CompassBearingContext). AE379 ships the
 * scene with a constant 0° bearing so the needle points North; later
 * slices wire actual geolocation + next-waypoint direction.
 *
 * Per 02-surfaces.md §5 Compass Bird, the full mode renders 3D city
 * blocks (Mapbox 3D buildings + custom shaders). That lands in AE391+
 * after the basic compass is felt-out.
 */
import { useMemo } from 'react';
import { useTheme } from '@app/aether-core';
import type { SurfaceMountProps } from '@app/aether-core';
import { CARDINALS, bearingPositionOnRing, normalizeBearing } from './compass-rose';
import { useCompassBearing } from './compass-bearing-context';

/** Compass rose radius in world units. Sized so the rose + a typical
 *  needle fit comfortably in AE375's [0, 0, 6] camera frame. */
const ROSE_RADIUS = 2.6;
/** Cardinal markers sit on a ring just inside the rose edge. */
const MARKER_RADIUS = 2.4;
/** Needle length — slightly shorter than the marker radius so the tip
 *  reads as "pointing toward" rather than "passing through". */
const NEEDLE_LENGTH = 2.0;
/** Altitude indicator ring is offset above the disc. */
const ALTITUDE_OFFSET = 0.18;

export default function CompassPhase1Scene(_props: SurfaceMountProps): React.ReactElement {
  const theme = useTheme();
  const bearing = useCompassBearing();

  const discColor = theme.color.surface.base;
  const markerColor = theme.palette.ochre.glow;
  const needleColor = theme.palette.terracotta.glow;
  const altitudeColor = theme.palette.olive.whisper ?? theme.palette.olive.base;

  // Pre-compute marker positions (deterministic so SSR-snapshot ready).
  const markerLayouts = useMemo(
    () =>
      CARDINALS.map((c) => ({
        label: c.label,
        position: bearingPositionOnRing(c.bearing, MARKER_RADIUS),
      })),
    [],
  );

  // Needle rotation — Three's default cylinder runs along +Y. We tilt it
  // 90° about +X so it lies on the XZ plane, then rotate around Y by the
  // negated bearing-in-radians (bearing 0 = +Z = forward in our frame).
  const needleRotationY = useMemo(() => {
    const d = normalizeBearing(bearing);
    return -(d * Math.PI) / 180;
  }, [bearing]);

  return (
    <>
      {/* Compass rose — flat disc. */}
      <mesh position={[0, -0.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[ROSE_RADIUS, ROSE_RADIUS, 0.05, 64]} />
        <meshStandardMaterial color={discColor} roughness={0.85} metalness={0.02} />
      </mesh>

      {/* Altitude ring — thin cylinder above the rose. */}
      <mesh position={[0, ALTITUDE_OFFSET, 0]}>
        <torusGeometry args={[ROSE_RADIUS * 0.85, 0.02, 12, 64]} />
        <meshStandardMaterial color={altitudeColor} roughness={0.6} transparent opacity={0.7} />
      </mesh>

      {/* Cardinal markers — small orbs at N/E/S/W. */}
      {markerLayouts.map(({ label, position }) => (
        <mesh key={`cardinal-${label}`} position={[position.x, ALTITUDE_OFFSET * 1.6, position.z]}>
          <sphereGeometry args={[label === 'N' ? 0.18 : 0.12, 18, 18]} />
          <meshStandardMaterial
            color={markerColor}
            roughness={0.45}
            emissive={label === 'N' ? markerColor : '#000'}
            emissiveIntensity={label === 'N' ? 0.35 : 0}
          />
        </mesh>
      ))}

      {/* Needle group — rotated by bearing so children point along +Z. */}
      <group rotation={[0, needleRotationY, 0]} position={[0, 0.1, 0]}>
        {/* Tip: a tapered cone leaning forward along +Z. */}
        <mesh position={[0, 0, NEEDLE_LENGTH / 2 - 0.15]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.12, NEEDLE_LENGTH, 24]} />
          <meshStandardMaterial color={needleColor} roughness={0.4} metalness={0.2} />
        </mesh>
        {/* Tail: a smaller olive cone in the opposite direction. */}
        <mesh position={[0, 0, -NEEDLE_LENGTH / 3]} rotation={[-Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.07, NEEDLE_LENGTH * 0.6, 18]} />
          <meshStandardMaterial color={theme.palette.olive.base} roughness={0.55} />
        </mesh>
        {/* Hub — small sphere at the pivot. */}
        <mesh position={[0, 0.02, 0]}>
          <sphereGeometry args={[0.18, 20, 20]} />
          <meshStandardMaterial color={needleColor} roughness={0.35} metalness={0.25} />
        </mesh>
      </group>
    </>
  );
}
