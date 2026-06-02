/**
 * `<AetherAtlasScene/>` — the fourth Aether mobile surface, second
 * R3F-native one (Phase 4 AE539).
 *
 * Atlas is the trip studio (docs/aether/02-surfaces.md section 3): the
 * itinerary rendered as a cloud of place orbs along a 3D timeline. This
 * is the native R3F port of the web Atlas Phase 1 scene
 * (apps/web/src/components/aether/phase1/atlas-phase1-scene.tsx).
 *
 * Like Drift (AE536) it mounts a real @react-three/fiber/native
 * <Canvas>. The orb world-coordinates come from the SAME pure layout
 * the web R3F scene uses — `layoutOrbsForTrip` + `layoutDayMarkers`
 * from `@app/aether-canvas-shared` (AE456, spec'd at AE509) — so a
 * trip's orbs sit at identical positions on web + mobile.
 *
 * AE539 first cut renders the static orb field + day-marker ticks:
 *   - one sphere per itinerary item at its (x, y, z)
 *   - a small tick under each day along the timeline
 *   - a gentle whole-field idle rotation (frozen under reducedMotion)
 *
 * Not yet ported (later slices): PlaceOrb drag physics, the draggable
 * timeline, tap-to-focus, the per-orb place card. AE539 proves the
 * Atlas scene renders from real itinerary data.
 */
import { useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, useFrame } from '@react-three/fiber/native';
import {
  cameraPoseAt,
  layoutDayMarkers,
  layoutOrbsForTrip,
  orbColorForItem,
  orbSizeForItem,
  type AtlasDayLike,
} from '@app/aether-canvas-shared';
import type { Group } from 'three';

/** Warm Italian accents — locked AE palette. Once aether-core-native is
 *  consumed we'll read these from the palette context instead. */
const ORB_COLOR = '#E8B777'; // ochre glow
const MARKER_COLOR = '#6E7B5C'; // olive support
const BACKGROUND = '#1A1714'; // ink

/** Idle camera pose from the shared lifecycle-camera script. Atlas
 *  shares Drift's hero distance so the surfaces cut to one another
 *  without a jarring zoom. */
const IDLE_POSE = cameraPoseAt('idle', 0);

/** Whole-field idle rotation (radians / second). Slow enough to read as
 *  "the timeline is alive" without inducing motion sickness. */
const FIELD_RADIANS_PER_SECOND = (2 * Math.PI) / 90;

export interface AetherAtlasSceneProps {
  /** The itinerary days to render. Same shape the web Atlas scene reads
   *  from `useTripControllerGetItinerary`. */
  days: ReadonlyArray<AtlasDayLike>;
  /** Freeze the idle rotation when OS Reduce Motion is on. */
  reducedMotion?: boolean;
}

/** The rotating group of orbs + day markers. */
function AtlasField({
  days,
  reducedMotion,
}: {
  days: ReadonlyArray<AtlasDayLike>;
  reducedMotion: boolean;
}): React.ReactElement {
  const groupRef = useRef<Group>(null);
  const elapsedRef = useRef<number>(0);

  const orbs = useMemo(() => layoutOrbsForTrip(days), [days]);
  const markers = useMemo(() => layoutDayMarkers(days), [days]);

  // A flat list of items so we can map item -> size/color via the shared
  // helpers (which take the AtlasItemLike, not the OrbLayout).
  const itemsById = useMemo(() => {
    const map = new Map<string, { id: string; position: number; placeId: string | null }>();
    for (const day of days) {
      for (const item of day.items) map.set(item.id, item);
    }
    return map;
  }, [days]);

  useFrame((_state, delta) => {
    if (reducedMotion) return;
    elapsedRef.current += delta;
    const group = groupRef.current;
    if (group) group.rotation.y = elapsedRef.current * FIELD_RADIANS_PER_SECOND;
  });

  return (
    <group ref={groupRef}>
      {orbs.map((orb) => {
        const item = itemsById.get(orb.id);
        const size = item ? orbSizeForItem(item) : 0.18;
        const color = item ? orbColorForItem(item, ORB_COLOR) : ORB_COLOR;
        return (
          <mesh key={orb.id} position={[orb.x, orb.y, orb.z]}>
            <sphereGeometry args={[size, 24, 24]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.35} />
          </mesh>
        );
      })}
      {markers.map((marker) => (
        <mesh key={`marker-${marker.dayIndex}`} position={[marker.x, -1, 0]}>
          <boxGeometry args={[0.05, 0.5, 0.05]} />
          <meshStandardMaterial color={MARKER_COLOR} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * The Atlas surface scene. Mounts an R3F-native <Canvas> rendering the
 * trip's orb field. Sizes to its parent via flex: 1.
 */
export function AetherAtlasScene({
  days,
  reducedMotion = false,
}: AetherAtlasSceneProps): React.ReactElement {
  return (
    <View style={styles.container} testID="aether-atlas-scene">
      <Canvas camera={{ position: IDLE_POSE.position, fov: 60 }} style={styles.canvas}>
        <color attach="background" args={[BACKGROUND]} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[4, 6, 8]} intensity={0.8} />
        <AtlasField days={days} reducedMotion={reducedMotion} />
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
