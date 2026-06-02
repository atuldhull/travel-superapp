/**
 * `<AetherCompassScene/>` — the fifth Aether mobile surface, third
 * R3F-native one (Phase 4 AE543).
 *
 * Compass is the spatial navigator (docs/aether/02-surfaces.md section
 * 5). The bird-mode rose ships here; eye-mode AR is deferred to Phase 5
 * per locked decision #8. Native R3F port of the web Compass scene.
 *
 * The rose geometry comes from the SAME pure helpers the web R3F scene
 * uses — `bearingPositionOnRing` + `CARDINALS` + `normalizeBearing`
 * from `@app/aether-canvas-shared` (AE456, pinned by the AE489
 * unit-vector invariants). So a heading places the needle at an
 * identical world position on web + mobile.
 *
 * Composition:
 *   - a torus ring (the rose outline)
 *   - 4 cardinal markers at their bearings (North terracotta, the rest
 *     cream)
 *   - a needle bar rotated to the current heading, terracotta-tipped at
 *     the north end
 *
 * AE543 ships a self-spinning demo heading (frozen under reducedMotion).
 * A future slice feeds the real device heading from expo-location's
 * `watchHeadingAsync`.
 */
import { useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, useFrame } from '@react-three/fiber/native';
import { CARDINALS, bearingPositionOnRing } from '@app/aether-canvas-shared';
import type { Group } from 'three';

const NORTH_COLOR = '#C2614A'; // terracotta accent
const CARDINAL_COLOR = '#F2E8D5'; // cream
const RING_COLOR = '#6E7B5C'; // olive support
const BACKGROUND = '#1A1714'; // ink

/** Ring radius (world units). */
const RING_RADIUS = 2.4;

/** Demo heading rotation (radians / second) — one slow sweep so the
 *  needle reads as alive without a real compass feed. */
const HEADING_RADIANS_PER_SECOND = (2 * Math.PI) / 30;

export interface AetherCompassSceneProps {
  /** Fixed heading in degrees. When omitted the needle slowly sweeps
   *  (demo mode). */
  headingDegrees?: number;
  /** Freeze the demo sweep when OS Reduce Motion is on. */
  reducedMotion?: boolean;
}

/** The rose: ring + cardinal markers + the rotating needle. */
function CompassRose({
  headingDegrees,
  reducedMotion,
}: {
  headingDegrees?: number;
  reducedMotion: boolean;
}): React.ReactElement {
  const needleRef = useRef<Group>(null);
  const elapsedRef = useRef<number>(0);

  const cardinals = useMemo(
    () =>
      CARDINALS.map((c) => ({
        ...c,
        pos: bearingPositionOnRing(c.bearing, RING_RADIUS),
      })),
    [],
  );

  useFrame((_state, delta) => {
    const needle = needleRef.current;
    if (!needle) return;
    if (headingDegrees !== undefined) {
      needle.rotation.y = (headingDegrees * Math.PI) / 180;
      return;
    }
    if (reducedMotion) return;
    elapsedRef.current += delta;
    needle.rotation.y = elapsedRef.current * HEADING_RADIANS_PER_SECOND;
  });

  return (
    <group>
      {/* The rose outline as a flat ring on the XZ plane. */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[RING_RADIUS, 0.03, 12, 96]} />
        <meshStandardMaterial color={RING_COLOR} />
      </mesh>

      {/* Cardinal markers. */}
      {cardinals.map((c) => (
        <mesh key={c.label} position={[c.pos.x, 0, c.pos.z]}>
          <sphereGeometry args={[c.label === 'N' ? 0.16 : 0.11, 20, 20]} />
          <meshStandardMaterial
            color={c.label === 'N' ? NORTH_COLOR : CARDINAL_COLOR}
            emissive={c.label === 'N' ? NORTH_COLOR : '#000000'}
            emissiveIntensity={c.label === 'N' ? 0.4 : 0}
          />
        </mesh>
      ))}

      {/* The needle — a bar along +Z (north when heading 0), terracotta
          tip at the far end. rotation.y maps +Z onto the heading. */}
      <group ref={needleRef}>
        <mesh position={[0, 0, RING_RADIUS * 0.45]}>
          <boxGeometry args={[0.06, 0.04, RING_RADIUS * 0.9]} />
          <meshStandardMaterial color={CARDINAL_COLOR} />
        </mesh>
        <mesh position={[0, 0, RING_RADIUS * 0.9]}>
          <coneGeometry args={[0.12, 0.32, 16]} />
          <meshStandardMaterial
            color={NORTH_COLOR}
            emissive={NORTH_COLOR}
            emissiveIntensity={0.5}
          />
        </mesh>
        {/* Centre hub. */}
        <mesh>
          <sphereGeometry args={[0.14, 20, 20]} />
          <meshStandardMaterial color={RING_COLOR} />
        </mesh>
      </group>
    </group>
  );
}

/**
 * The Compass surface scene. Mounts an R3F-native <Canvas> with the
 * bird-mode rose, viewed from slightly above so the ring reads as a
 * top-down navigator.
 */
export function AetherCompassScene({
  headingDegrees,
  reducedMotion = false,
}: AetherCompassSceneProps): React.ReactElement {
  return (
    <View style={styles.container} testID="aether-compass-scene">
      <Canvas camera={{ position: [0, 4.5, 4.5], fov: 55 }} style={styles.canvas}>
        <color attach="background" args={[BACKGROUND]} />
        <ambientLight intensity={0.7} />
        <directionalLight position={[3, 8, 5]} intensity={0.7} />
        <CompassRose headingDegrees={headingDegrees} reducedMotion={reducedMotion} />
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  canvas: {
    flex: 1,
  },
});
