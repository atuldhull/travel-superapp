/**
 * `<AetherLumenScene/>` — the seventh Aether mobile surface, fifth
 * R3F-native one (Phase 4 AE549).
 *
 * Lumen is the memory studio (docs/aether/02-surfaces.md section 4):
 * a trip's photos suspended in a 3D cloud, spread along time (X) and
 * rating (Y). Native R3F port of the web Lumen scene.
 *
 * The cloud layout comes from the SAME pure helper the web R3F scene
 * uses — `layoutPhotoCloud` from `@app/aether-canvas-shared` (AE457,
 * spec'd at AE507) — so a photo set produces an identical cloud on web
 * + mobile. Each `LumenPlaneLayout` carries its world position + size.
 *
 * AE549 first cut paints solid palette-tinted planes (no textures yet):
 * the brightness of each plane keys to its X position so the cloud
 * reads as a gradient across time. Real photo textures via Expo Asset
 * + `<PhotoPlane>` land in a later slice; the `url` field on each plane
 * is already threaded through so that swap is local.
 *
 * A gentle whole-cloud idle rotation gives the suspension life (frozen
 * under reducedMotion).
 */
import { useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, useFrame } from '@react-three/fiber/native';
import {
  DEFAULT_LUMEN_LAYOUT,
  cameraPoseAt,
  layoutPhotoCloud,
  type LumenPhotoLike,
} from '@app/aether-canvas-shared';
import type { Group } from 'three';

const PLANE_WARM = '#E8B777'; // ochre glow (recent photos)
const PLANE_COOL = '#6E7B5C'; // olive support (older photos)
const BACKGROUND = '#1A1714'; // ink

/** Idle camera pose — Lumen pulls back a touch from the hero distance
 *  so the wider time axis (18 units) fits the frame. */
const IDLE_POSE = cameraPoseAt('idle', 0);

/** Slow whole-cloud rotation (radians / second). */
const CLOUD_RADIANS_PER_SECOND = (2 * Math.PI) / 120;

export interface AetherLumenSceneProps {
  /** The photos to suspend in the cloud. Same shape the web Lumen scene
   *  reads from the media SDK. */
  photos: ReadonlyArray<LumenPhotoLike>;
  /** Freeze the idle rotation when OS Reduce Motion is on. */
  reducedMotion?: boolean;
}

/** Linear blend between two hex colours by t in [0,1]. Local to the
 *  scene — the canonical blend lives in @app/aether-core's palette
 *  helpers but those are web-React-typed; this 3-channel lerp keeps
 *  the native scene dependency-light. */
function blendHex(a: string, b: string, t: number): string {
  const clamp = Math.max(0, Math.min(1, t));
  const pa = [
    parseInt(a.slice(1, 3), 16),
    parseInt(a.slice(3, 5), 16),
    parseInt(a.slice(5, 7), 16),
  ];
  const pb = [
    parseInt(b.slice(1, 3), 16),
    parseInt(b.slice(3, 5), 16),
    parseInt(b.slice(5, 7), 16),
  ];
  const ch = (i: number): string => {
    const va = pa[i] ?? 0;
    const vb = pb[i] ?? 0;
    return Math.round(va + (vb - va) * clamp)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${ch(0)}${ch(1)}${ch(2)}`;
}

/** The rotating cloud of photo planes. */
function PhotoCloud({
  photos,
  reducedMotion,
}: {
  photos: ReadonlyArray<LumenPhotoLike>;
  reducedMotion: boolean;
}): React.ReactElement {
  const groupRef = useRef<Group>(null);
  const elapsedRef = useRef<number>(0);

  const planes = useMemo(() => layoutPhotoCloud(photos), [photos]);

  // Map each plane's X (time axis) to a warm->cool tint so the cloud
  // reads as a gradient across the trip even without real textures.
  const halfX = DEFAULT_LUMEN_LAYOUT.axisLengthX / 2;

  useFrame((_state, delta) => {
    if (reducedMotion) return;
    elapsedRef.current += delta;
    const group = groupRef.current;
    if (group) group.rotation.y = elapsedRef.current * CLOUD_RADIANS_PER_SECOND;
  });

  return (
    <group ref={groupRef}>
      {planes.map((plane) => {
        const t = (plane.position[0] + halfX) / DEFAULT_LUMEN_LAYOUT.axisLengthX;
        const color = blendHex(PLANE_COOL, PLANE_WARM, t);
        return (
          <mesh key={plane.id} position={[plane.position[0], plane.position[1], plane.position[2]]}>
            <planeGeometry args={[plane.size, plane.size]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.2} />
          </mesh>
        );
      })}
    </group>
  );
}

/**
 * The Lumen surface scene. Mounts an R3F-native <Canvas> with the photo
 * cloud. Sizes to its parent via flex: 1.
 */
export function AetherLumenScene({
  photos,
  reducedMotion = false,
}: AetherLumenSceneProps): React.ReactElement {
  return (
    <View style={styles.container} testID="aether-lumen-scene">
      <Canvas
        camera={{ position: [IDLE_POSE.position[0], 1.5, 12], fov: 60 }}
        style={styles.canvas}
      >
        <color attach="background" args={[BACKGROUND]} />
        <ambientLight intensity={0.8} />
        <directionalLight position={[4, 6, 8]} intensity={0.5} />
        <PhotoCloud photos={photos} reducedMotion={reducedMotion} />
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
