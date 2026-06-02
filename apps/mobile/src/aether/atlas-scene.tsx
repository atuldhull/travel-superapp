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
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber/native';
import {
  cameraPoseAt,
  layoutDayMarkers,
  layoutOrbsForTrip,
  orbColorForItem,
  orbSizeForItem,
  type AtlasDayLike,
  type OrbLayout,
} from '@app/aether-canvas-shared';
import type { Group } from 'three';
import { useR3FSelection } from '../../lib/use-r3f-selection';
import { AETHER_ACCENT, AETHER_GLOW, AETHER_INK, AETHER_SUPPORT } from './palette';

const FOCUS_COLOR = AETHER_ACCENT; // terracotta — the focused orb
const ORB_COLOR = AETHER_GLOW; // ochre glow
const MARKER_COLOR = AETHER_SUPPORT; // olive support
const BACKGROUND = AETHER_INK; // ink

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
  focusedId,
  onSelect,
}: {
  days: ReadonlyArray<AtlasDayLike>;
  reducedMotion: boolean;
  focusedId: string | null;
  onSelect: (orb: OrbLayout) => void;
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
    // Pause the idle rotation while an orb is focused so the place card
    // stays readable; resume when focus clears.
    if (reducedMotion || focusedId !== null) return;
    elapsedRef.current += delta;
    const group = groupRef.current;
    if (group) group.rotation.y = elapsedRef.current * FIELD_RADIANS_PER_SECOND;
  });

  return (
    <group ref={groupRef}>
      {orbs.map((orb) => {
        const item = itemsById.get(orb.id);
        const focused = orb.id === focusedId;
        const size = (item ? orbSizeForItem(item) : 0.18) * (focused ? 1.5 : 1);
        const color = focused ? FOCUS_COLOR : item ? orbColorForItem(item, ORB_COLOR) : ORB_COLOR;
        return (
          <mesh
            key={orb.id}
            position={[orb.x, orb.y, orb.z]}
            onClick={(e: ThreeEvent<unknown>) => {
              e.stopPropagation();
              onSelect(orb);
            }}
          >
            <sphereGeometry args={[size, 24, 24]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={focused ? 0.7 : 0.35}
            />
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

/** The place card shown when an orb is focused. Synthetic place data
 *  for now (the sample trip uses `place-<slug>` ids); a future slice
 *  reads the real place row via the SDK. */
function PlaceCard({ orb, onClose }: { orb: OrbLayout; onClose: () => void }): React.ReactElement {
  const placeName = (orb.placeId ?? 'unknown-place').replace(/^place-/, '').replace(/-/g, ' ');
  return (
    <View style={styles.card}>
      <Text style={styles.cardDay}>
        Day {orb.dayIndex + 1} · stop {orb.itemPosition + 1}
      </Text>
      <Text style={styles.cardPlace}>{placeName}</Text>
      <Pressable onPress={onClose} style={styles.cardClose} accessibilityRole="button">
        <Text style={styles.cardCloseText}>Close</Text>
      </Pressable>
    </View>
  );
}

/**
 * The Atlas surface scene. Mounts an R3F-native <Canvas> rendering the
 * trip's orb field. Tap an orb to focus it + show its place card.
 */
export function AetherAtlasScene({
  days,
  reducedMotion = false,
}: AetherAtlasSceneProps): React.ReactElement {
  // Shared R3F tap-to-select state (AE579). `selectedId` pauses the
  // idle field rotation + highlights the focused orb; `selected` mounts
  // the place card.
  const {
    selected: focused,
    selectedId,
    select,
    close,
  } = useR3FSelection<OrbLayout>((orb) => orb.id);

  return (
    <View style={styles.container} testID="aether-atlas-scene">
      <Canvas camera={{ position: IDLE_POSE.position, fov: 60 }} style={styles.canvas}>
        <color attach="background" args={[BACKGROUND]} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[4, 6, 8]} intensity={0.8} />
        <AtlasField
          days={days}
          reducedMotion={reducedMotion}
          focusedId={selectedId}
          onSelect={select}
        />
      </Canvas>
      {focused ? <PlaceCard orb={focused} onClose={close} /> : null}
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
  cardDay: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#6E7B5C',
  },
  cardPlace: {
    fontSize: 20,
    fontWeight: '600',
    color: '#F2E8D5',
    textTransform: 'capitalize',
  },
  cardClose: {
    alignSelf: 'flex-start',
    paddingTop: 8,
  },
  cardCloseText: {
    fontSize: 14,
    color: '#E8B777',
    fontWeight: '600',
  },
});
