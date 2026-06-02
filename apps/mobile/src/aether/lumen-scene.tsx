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
import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber/native';
import {
  DEFAULT_LUMEN_LAYOUT,
  cameraPoseAt,
  clampRating,
  layoutPhotoCloud,
  type LumenPhotoLike,
} from '@app/aether-canvas-shared';
import type { Group } from 'three';
import { AETHER_ACCENT, AETHER_CREAM, AETHER_GLOW, AETHER_INK, AETHER_SUPPORT } from './palette';

const PLANE_WARM = AETHER_GLOW; // ochre glow (recent photos)
const PLANE_COOL = AETHER_SUPPORT; // olive support (older photos)
const BACKGROUND = AETHER_INK; // ink

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
  focusedId,
  onSelect,
}: {
  photos: ReadonlyArray<LumenPhotoLike>;
  reducedMotion: boolean;
  focusedId: string | null;
  onSelect: (photo: LumenPhotoLike) => void;
}): React.ReactElement {
  const groupRef = useRef<Group>(null);
  const elapsedRef = useRef<number>(0);

  const planes = useMemo(() => layoutPhotoCloud(photos), [photos]);
  const photosById = useMemo(() => {
    const map = new Map<string, LumenPhotoLike>();
    for (const p of photos) map.set(p.id, p);
    return map;
  }, [photos]);

  // Map each plane's X (time axis) to a warm->cool tint so the cloud
  // reads as a gradient across the trip even without real textures.
  const halfX = DEFAULT_LUMEN_LAYOUT.axisLengthX / 2;

  useFrame((_state, delta) => {
    // Pause the drift while a photo is focused so the card stays put.
    if (reducedMotion || focusedId !== null) return;
    elapsedRef.current += delta;
    const group = groupRef.current;
    if (group) group.rotation.y = elapsedRef.current * CLOUD_RADIANS_PER_SECOND;
  });

  return (
    <group ref={groupRef}>
      {planes.map((plane) => {
        const t = (plane.position[0] + halfX) / DEFAULT_LUMEN_LAYOUT.axisLengthX;
        const focused = plane.id === focusedId;
        const color = focused ? AETHER_ACCENT : blendHex(PLANE_COOL, PLANE_WARM, t);
        const size = plane.size * (focused ? 1.4 : 1);
        return (
          <mesh
            key={plane.id}
            position={[plane.position[0], plane.position[1], plane.position[2]]}
            onClick={(e: ThreeEvent<unknown>) => {
              e.stopPropagation();
              const photo = photosById.get(plane.id);
              if (photo) onSelect(photo);
            }}
          >
            <planeGeometry args={[size, size]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={focused ? 0.5 : 0.2}
            />
          </mesh>
        );
      })}
    </group>
  );
}

/** The detail card for a tapped photo. Shows the rating + capture time;
 *  a future slice swaps in the real thumbnail once textures land. */
function PhotoCard({
  photo,
  onClose,
}: {
  photo: LumenPhotoLike;
  onClose: () => void;
}): React.ReactElement {
  const rating = clampRating(photo.rating);
  const stars = rating > 0 ? '★'.repeat(Math.round(rating)) : 'Unrated';
  const captured =
    photo.capturedAt !== null && photo.capturedAt !== ''
      ? new Date(photo.capturedAt).toLocaleString()
      : 'No capture time';
  return (
    <View style={styles.card}>
      <Text style={styles.cardRating}>{stars}</Text>
      <Text style={styles.cardCaptured}>{captured}</Text>
      <Pressable onPress={onClose} style={styles.cardClose} accessibilityRole="button">
        <Text style={styles.cardCloseText}>Close</Text>
      </Pressable>
    </View>
  );
}

/**
 * The Lumen surface scene. Mounts an R3F-native <Canvas> with the photo
 * cloud. Tap a plane to inspect that photo's rating + capture time.
 */
export function AetherLumenScene({
  photos,
  reducedMotion = false,
}: AetherLumenSceneProps): React.ReactElement {
  const [focused, setFocused] = useState<LumenPhotoLike | null>(null);
  const onSelect = useCallback((photo: LumenPhotoLike) => setFocused(photo), []);
  const onClose = useCallback(() => setFocused(null), []);

  return (
    <View style={styles.container} testID="aether-lumen-scene">
      <Canvas
        camera={{ position: [IDLE_POSE.position[0], 1.5, 12], fov: 60 }}
        style={styles.canvas}
      >
        <color attach="background" args={[BACKGROUND]} />
        <ambientLight intensity={0.8} />
        <directionalLight position={[4, 6, 8]} intensity={0.5} />
        <PhotoCloud
          photos={photos}
          reducedMotion={reducedMotion}
          focusedId={focused?.id ?? null}
          onSelect={onSelect}
        />
      </Canvas>
      {focused ? <PhotoCard photo={focused} onClose={onClose} /> : null}
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
  card: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 32,
    backgroundColor: '#24201C',
    borderRadius: 16,
    padding: 20,
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
  },
  cardRating: {
    fontSize: 22,
    color: AETHER_GLOW,
  },
  cardCaptured: {
    fontSize: 13,
    color: AETHER_CREAM,
  },
  cardClose: {
    alignSelf: 'flex-start',
    paddingTop: 8,
  },
  cardCloseText: {
    fontSize: 14,
    color: AETHER_GLOW,
    fontWeight: '600',
  },
});
