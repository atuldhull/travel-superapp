/**
 * `<AetherDriftScene/>` — the third Aether mobile surface, and the
 * FIRST R3F-native one (Phase 4 AE536).
 *
 * Per the AR-locked renderer policy
 * (`@app/aether-canvas-native/src/renderer-policy.ts`, decision #2):
 * Drift is a depth surface, so it renders with **R3F-native** (via
 * expo-gl + expo-three + @react-three/fiber/native) rather than Skia.
 * Pulse + Continuum (AE526 / AE531) proved the Skia path; this proves
 * the 3D path that 7 of the 10 surfaces depend on.
 *
 * The scene mirrors the web Drift Phase 1 scene
 * (apps/web/src/components/aether/phase1/drift-phase1-scene.tsx):
 *   • a slow-rotating terracotta sun disk
 *   • a deterministic cloud of ~600 ochre dust motes
 * both laid out from the SAME pure helpers the web R3F scene uses —
 * `sunDiskRotation` + `ambientFieldPositionArray` from
 * `@app/aether-canvas-shared` (AE535). The web `<SunDisk>`/`<AmbientField>`
 * and this native scene therefore place identical geometry.
 *
 * R3F-native specifics:
 *   - `@react-three/fiber/native`'s `<Canvas>` wires an expo-gl
 *     GLView under the hood; no manual GL plumbing here.
 *   - `useFrame` drives the sun rotation from R3F's own clock. When
 *     `reducedMotion` is set the rotation is frozen (decision #4).
 *   - The dust cloud is a single `<points>` with a BufferGeometry
 *     position attribute built once from the shared helper.
 *
 * AE536 ships the scene as a self-contained component. AE537 mounts it
 * behind a route. Surface-manager wiring (lifecycle phase -> burst
 * direction) lands once aether-core-native is consumed by mobile.
 */
import { useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, useFrame } from '@react-three/fiber/native';
import {
  ambientFieldPositionArray,
  sunDiskRotation,
  DEFAULT_DRIFT_BOUNDS,
  DEFAULT_DRIFT_MOTE_COUNT,
  cameraPoseAt,
} from '@app/aether-canvas-shared';
import type { BufferGeometry, Mesh, Points } from 'three';
import { AETHER_ACCENT, AETHER_GLOW, AETHER_INK } from './palette';

const SUN_COLOR = AETHER_ACCENT; // terracotta accent
const MOTE_COLOR = AETHER_GLOW; // ochre glow
const BACKGROUND = AETHER_INK; // ink

/** Idle camera pose from the shared lifecycle-camera script (AE454).
 *  Drift sits at the hero distance looking at the origin. */
const IDLE_POSE = cameraPoseAt('idle', 0);

export interface AetherDriftSceneProps {
  /** Freeze the sun rotation + mote drift when the OS Reduce Motion
   *  setting is on. Threaded from `useReducedMotionNative()`. */
  reducedMotion?: boolean;
  /** Override the dust-mote count (default 600, matching the web field). */
  moteCount?: number;
}

/** Slow-rotating terracotta sun disk. A flat circle facing the camera;
 *  the rotation reads through the subtle gradient once a shader lands —
 *  for AE536 it's a solid disk that turns. */
function SunDisk({ reducedMotion }: { reducedMotion: boolean }): React.ReactElement {
  const meshRef = useRef<Mesh>(null);
  const elapsedRef = useRef<number>(0);

  useFrame((_state, delta) => {
    if (reducedMotion) return;
    elapsedRef.current += delta * 1000;
    const mesh = meshRef.current;
    if (mesh) mesh.rotation.z = sunDiskRotation(elapsedRef.current);
  });

  return (
    <mesh ref={meshRef} position={[0, 0.4, 0]}>
      <circleGeometry args={[1.8, 64]} />
      <meshBasicMaterial color={SUN_COLOR} />
    </mesh>
  );
}

/** Deterministic dust-mote cloud built once from the shared helper. */
function AmbientField({ count }: { count: number }): React.ReactElement {
  const geomRef = useRef<BufferGeometry>(null);
  const pointsRef = useRef<Points>(null);

  const positions = useMemo(() => ambientFieldPositionArray(count, DEFAULT_DRIFT_BOUNDS), [count]);

  return (
    <points ref={pointsRef}>
      <bufferGeometry ref={geomRef}>
        {/* `args` constructs `new THREE.BufferAttribute(positions, 3)`;
            R3F derives count = array.length / itemSize from it. */}
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color={MOTE_COLOR} size={0.06} sizeAttenuation transparent opacity={0.7} />
    </points>
  );
}

/**
 * The Drift surface scene. Mounts an R3F-native `<Canvas>` with the
 * sun disk + ambient field. Sizes to its parent via `flex: 1`.
 */
export function AetherDriftScene({
  reducedMotion = false,
  moteCount = DEFAULT_DRIFT_MOTE_COUNT,
}: AetherDriftSceneProps): React.ReactElement {
  return (
    <View style={styles.container} testID="aether-drift-scene">
      <Canvas
        camera={{ position: IDLE_POSE.position, fov: 60 }}
        style={styles.canvas}
        gl={{ antialias: true }}
      >
        <color attach="background" args={[BACKGROUND]} />
        <ambientLight intensity={0.8} />
        <SunDisk reducedMotion={reducedMotion} />
        <AmbientField count={moteCount} />
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
