'use client';

/**
 * AE421/AE422 — Mirror Phase 3 R3F scene.
 *
 * Per docs/aether/02-surfaces.md §9 Mirror: SOS events as pulsing red
 * dots on a globe + scam-report clusters as larger discs + audit-log
 * river overlay. AE421 ships the slow-rotating globe + dot stand-ins;
 * AE422 fills in the textured land mass + pulsing animation + audit
 * river overlay HTML on top.
 */
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { useSurfacePaletteSlots, type SurfaceMountProps } from '@app/aether-core';
import { MIRROR_GLOBE_RADIUS, latLngToVec3, scamClusterRadius, sosDotRadius } from './mirror-globe';
import { SAMPLE_MIRROR_SCAM, SAMPLE_MIRROR_SOS } from './mirror-sample-data';

export default function MirrorPhase3Scene(
  _props: Partial<SurfaceMountProps> = {},
): React.ReactElement {
  const palette = useSurfacePaletteSlots();
  const globeRef = useRef<Group>(null);

  // Slow global rotation so the globe reads as "live ops view".
  useFrame((_state, delta) => {
    const g = globeRef.current;
    if (g === null) return;
    g.rotation.y += delta * 0.06;
  });

  const sosDots = useMemo(
    () =>
      SAMPLE_MIRROR_SOS.map((s) => ({
        id: s.id,
        position: latLngToVec3(s.lat, s.lng, MIRROR_GLOBE_RADIUS + 0.02),
        radius: sosDotRadius(s.severity),
      })),
    [],
  );
  const scamDiscs = useMemo(
    () =>
      SAMPLE_MIRROR_SCAM.map((c) => ({
        id: c.id,
        position: latLngToVec3(c.lat, c.lng, MIRROR_GLOBE_RADIUS + 0.01),
        radius: scamClusterRadius(c.reportCount),
      })),
    [],
  );

  return (
    <>
      <ambientLight intensity={0.45} />
      <directionalLight position={[5, 8, 6]} intensity={0.65} />

      <group ref={globeRef}>
        {/* The globe itself — a translucent sphere tinted with the
            Mirror palette accent. */}
        <mesh>
          <sphereGeometry args={[MIRROR_GLOBE_RADIUS, 48, 32]} />
          <meshStandardMaterial
            color={palette.accent}
            transparent
            opacity={0.42}
            roughness={0.55}
          />
        </mesh>

        {/* Latitude / longitude grid hint — a wireframe sphere just
            outside the solid one so the rotation reads. */}
        <mesh>
          <sphereGeometry args={[MIRROR_GLOBE_RADIUS + 0.005, 18, 12]} />
          <meshBasicMaterial color={palette.support} wireframe transparent opacity={0.18} />
        </mesh>

        {/* SOS dots — bright red so the operator's eye snaps to them. */}
        {sosDots.map((d) => (
          <mesh key={d.id} position={d.position}>
            <sphereGeometry args={[d.radius, 16, 12]} />
            <meshStandardMaterial
              color="#E04A4A"
              emissive="#E04A4A"
              emissiveIntensity={0.7}
              roughness={0.4}
            />
          </mesh>
        ))}

        {/* Scam clusters — palette-glow discs (oriented along the
            normal at their position would be ideal, but a simple
            sphere reads fine for the first cut). */}
        {scamDiscs.map((d) => (
          <mesh key={d.id} position={d.position}>
            <sphereGeometry args={[d.radius, 18, 14]} />
            <meshStandardMaterial
              color={palette.glow}
              transparent
              opacity={0.78}
              roughness={0.45}
            />
          </mesh>
        ))}
      </group>
    </>
  );
}
