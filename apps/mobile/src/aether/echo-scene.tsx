/**
 * `<AetherEchoScene/>` — the eighth Aether mobile surface, sixth
 * R3F-native one (Phase 4 AE551).
 *
 * Echo is the social feed (docs/aether/02-surfaces.md section 6): a
 * vertical stack of traveller "echoes" you swipe through. Native R3F
 * port of the web Echo scene — a depth stack of cards rather than a
 * flat FlatList, so the surface keeps the Aether spatial feel.
 *
 * The card stack geometry comes from the SAME pure helpers the web R3F
 * scene uses — `echoCardY` + `echoCardScale` + `echoCardOpacity` +
 * `visibleEchoSlots` from `@app/aether-canvas-shared` (AE477, spec'd at
 * AE503). Each card's per-photo tint comes from
 * `echoPaletteFromDominantColor(dominantColor)` so the AE420 palette
 * re-derivation drives the surface identically to web.
 *
 * AE551 first cut renders the active card + its neighbours as
 * palette-tinted planes (no textures yet). The swipe-to-advance gesture
 * (react-native-gesture-handler PanGesture -> echoActionForSwipe ->
 * nextEchoIndex) lands in a later interaction slice; for now the stack
 * slowly auto-advances so the depth reads in the preview.
 */
import { useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, useFrame } from '@react-three/fiber/native';
import {
  ECHO_CARD_HEIGHT,
  ECHO_CARD_WIDTH,
  echoCardOpacity,
  echoCardScale,
  echoCardY,
  echoPaletteFromDominantColor,
  visibleEchoSlots,
  type EchoItem,
} from '@app/aether-canvas-shared';

const BACKGROUND = '#1A1714'; // ink

/** Seconds each card stays active before the demo auto-advances. */
const AUTO_ADVANCE_SECONDS = 3.5;

export interface AetherEchoSceneProps {
  /** The feed to render. Same shape the web Echo scene reads from the
   *  social feed channel. */
  feed: ReadonlyArray<EchoItem>;
  /** Freeze the demo auto-advance when OS Reduce Motion is on. */
  reducedMotion?: boolean;
}

/** A single feed card — a palette-tinted plane positioned + scaled by
 *  its offset from the active index. */
function EchoCard({
  item,
  index,
  activeIndex,
}: {
  item: EchoItem;
  index: number;
  activeIndex: number;
}): React.ReactElement {
  const y = echoCardY(index, activeIndex);
  const scale = echoCardScale(index, activeIndex);
  const opacity = echoCardOpacity(index, activeIndex);
  // The AE420 palette: [ink, surface, accent, glow, support]. The card
  // face takes the surface slot; the active card lifts toward accent.
  const palette = echoPaletteFromDominantColor(item.dominantColor);
  const face = index === activeIndex ? (palette[2] ?? '#C2614A') : (palette[1] ?? '#F2E8D5');

  return (
    <mesh position={[0, y, 0]} scale={scale}>
      <planeGeometry args={[ECHO_CARD_WIDTH, ECHO_CARD_HEIGHT]} />
      <meshStandardMaterial
        color={face}
        transparent
        opacity={opacity}
        emissive={face}
        emissiveIntensity={0.12}
      />
    </mesh>
  );
}

/** The depth stack of visible cards. */
function EchoStack({
  feed,
  reducedMotion,
}: {
  feed: ReadonlyArray<EchoItem>;
  reducedMotion: boolean;
}): React.ReactElement {
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const elapsedRef = useRef<number>(0);

  useFrame((_state, delta) => {
    if (reducedMotion || feed.length === 0) return;
    elapsedRef.current += delta;
    if (elapsedRef.current >= AUTO_ADVANCE_SECONDS) {
      elapsedRef.current = 0;
      setActiveIndex((i) => (i + 1) % feed.length);
    }
  });

  const slots = useMemo(() => visibleEchoSlots(feed, activeIndex), [feed, activeIndex]);

  return (
    <group>
      {slots.map(({ item, index }) => (
        <EchoCard key={item.id} item={item} index={index} activeIndex={activeIndex} />
      ))}
    </group>
  );
}

/**
 * The Echo surface scene. Mounts an R3F-native <Canvas> with the card
 * depth stack. Sizes to its parent via flex: 1.
 */
export function AetherEchoScene({
  feed,
  reducedMotion = false,
}: AetherEchoSceneProps): React.ReactElement {
  return (
    <View style={styles.container} testID="aether-echo-scene">
      <Canvas camera={{ position: [0, 0, 9], fov: 55 }} style={styles.canvas}>
        <color attach="background" args={[BACKGROUND]} />
        <ambientLight intensity={0.9} />
        <directionalLight position={[2, 4, 6]} intensity={0.4} />
        <EchoStack feed={feed} reducedMotion={reducedMotion} />
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
