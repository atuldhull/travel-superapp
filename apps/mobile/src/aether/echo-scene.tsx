/**
 * `<AetherEchoScene/>` — the eighth Aether mobile surface, sixth
 * R3F-native one (Phase 4 AE551; real swipe gesture AE559).
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
 * AE559 wires the REAL swipe gesture: a react-native-gesture-handler
 * PanGesture feeds its translation into `echoSwipeDirectionFromDelta`
 * → `echoActionForSwipe` → `nextEchoIndex`, the exact pipeline the web
 * pointer handler uses. Swipe down walks the feed forward, up saves the
 * place, left/right rewind / follow. The auto-advance is gone now that
 * swipe drives it. `.runOnJS(true)` runs the gesture callback on the JS
 * thread so it can call the React state setter directly.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Canvas } from '@react-three/fiber/native';
import {
  ECHO_CARD_HEIGHT,
  ECHO_CARD_WIDTH,
  echoActionForSwipe,
  echoCardOpacity,
  echoCardScale,
  echoCardY,
  echoPaletteFromDominantColor,
  echoSwipeDirectionFromDelta,
  nextEchoIndex,
  visibleEchoSlots,
  type EchoAction,
  type EchoItem,
} from '@app/aether-canvas-shared';
import { AETHER_INK } from './palette';

const BACKGROUND = AETHER_INK; // ink

export interface AetherEchoSceneProps {
  /** The feed to render. Same shape the web Echo scene reads from the
   *  social feed channel. */
  feed: ReadonlyArray<EchoItem>;
  /** Reserved for parity with the other surfaces; Echo's motion is
   *  swipe-driven so there's no idle animation to freeze. */
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

/** The depth stack of visible cards for a given active index. */
function EchoStack({
  feed,
  activeIndex,
}: {
  feed: ReadonlyArray<EchoItem>;
  activeIndex: number;
}): React.ReactElement {
  const slots = useMemo(() => visibleEchoSlots(feed, activeIndex), [feed, activeIndex]);
  return (
    <group>
      {slots.map(({ item, index }) => (
        <EchoCard key={item.id} item={item} index={index} activeIndex={activeIndex} />
      ))}
    </group>
  );
}

/** How long (ms) the swipe-action hint stays visible. */
const HINT_MS = 1400;

function hintForAction(action: EchoAction): string {
  switch (action) {
    case 'next':
      return 'Next echo';
    case 'prev':
      return 'Previous echo';
    case 'save-place':
      return 'Saved this place';
    case 'follow-traveller':
      return 'Following traveller';
    case 'plan-like-this':
      return 'Planning a trip like this';
  }
}

/**
 * The Echo surface scene. An R3F card depth stack wrapped in a
 * PanGesture that walks the feed via the canvas-shared swipe pipeline.
 */
export function AetherEchoScene({ feed }: AetherEchoSceneProps): React.ReactElement {
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [hint, setHint] = useState<string | null>(null);
  // Track the hint timer so a rapid second swipe cancels the first
  // (instead of the first's timer clearing the second's hint), and so it
  // doesn't fire setHint after unmount (AE574).
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (hintTimer.current) clearTimeout(hintTimer.current);
    };
  }, []);

  const applySwipe = useCallback(
    (dx: number, dy: number) => {
      const direction = echoSwipeDirectionFromDelta(dx, dy);
      const action = echoActionForSwipe(direction);
      if (action === null) return;
      setActiveIndex((current) => nextEchoIndex(current, feed.length, action));
      setHint(hintForAction(action));
      if (hintTimer.current) clearTimeout(hintTimer.current);
      hintTimer.current = setTimeout(() => setHint(null), HINT_MS);
    },
    [feed.length],
  );

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .onEnd((e) => {
          applySwipe(e.translationX, e.translationY);
        }),
    [applySwipe],
  );

  const active = feed[activeIndex];

  return (
    <GestureDetector gesture={pan}>
      <View style={styles.container} testID="aether-echo-scene">
        <Canvas camera={{ position: [0, 0, 9], fov: 55 }} style={styles.canvas}>
          <color attach="background" args={[BACKGROUND]} />
          <ambientLight intensity={0.9} />
          <directionalLight position={[2, 4, 6]} intensity={0.4} />
          <EchoStack feed={feed} activeIndex={activeIndex} />
        </Canvas>

        <View style={styles.overlay} pointerEvents="none">
          {active ? (
            <View style={styles.activeMeta}>
              <Text style={styles.place}>{active.placeName}</Text>
              <Text style={styles.traveller}>@{active.travellerHandle}</Text>
            </View>
          ) : null}
          <Text style={styles.hint}>{hint ?? 'Swipe down for the next echo'}</Text>
        </View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND,
  },
  canvas: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 56,
    gap: 8,
  },
  activeMeta: {
    alignItems: 'center',
    gap: 2,
  },
  place: {
    fontSize: 20,
    fontWeight: '600',
    color: '#F2E8D5',
  },
  traveller: {
    fontSize: 13,
    color: '#E8B777',
  },
  hint: {
    fontSize: 13,
    color: '#9B8E7E',
  },
});
