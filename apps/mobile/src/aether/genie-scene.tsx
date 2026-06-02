/**
 * `<AetherGenieScene/>` — the ninth Aether mobile surface, seventh
 * R3F-native one (Phase 4 AE554).
 *
 * Genie is the voice/camera modal (docs/aether/02-surfaces.md section
 * 2): hold the Pulse, the surface dissolves into particles that swirl,
 * a waveform appears, you speak, the transcription writes itself. Native
 * port of the web Genie scene.
 *
 * The state machine comes from the SAME pure FSM the web Genie uses —
 * `genieStateLabel` + `genieMicRingColor` + `genieIsActive` +
 * `genieOnMicPress` / `genieOnMicRelease` / `genieOnStt` from
 * `@app/aether-canvas-shared` (AE406, spec'd at AE492). The particle
 * cloud reuses the shared `ambientFieldPositionArray` + the
 * `GENIE_PARTICLE_COUNT` constant so the swirl is deterministic.
 *
 * AE554 first cut ships the FSM + the particle swirl visual:
 *   - a R3F <points> cloud that rotates faster + glows brighter when
 *     genieIsActive(state) (listening / processing)
 *   - an RN mic button tinted by genieMicRingColor(state) with the
 *     genieStateLabel(state) copy
 *   - tapping the mic walks the FSM (press -> listening -> release ->
 *     processing -> a simulated STT -> transcribed -> tap -> listening)
 *
 * Real Whisper STT (expo-av recording -> ai-service /v1/transcribe) +
 * the camera mode (expo-camera) are the AE411b / AE413b backend
 * b-slices; AE554 proves the surface + FSM. The mic press is a tap, not
 * a real recording, until those land.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Canvas, useFrame } from '@react-three/fiber/native';
import {
  GENIE_PARTICLE_COUNT,
  ambientFieldPositionArray,
  genieIsActive,
  genieMicRingColor,
  genieOnMicPress,
  genieOnMicRelease,
  genieOnStt,
  genieStateLabel,
  type GenieState,
} from '@app/aether-canvas-shared';
import type { Points } from 'three';
import { AETHER_GLOW, AETHER_INK, AETHER_SUPPORT } from './palette';

const PARTICLE_IDLE = AETHER_SUPPORT; // olive support
const PARTICLE_ACTIVE = AETHER_GLOW; // ochre glow
const BACKGROUND = AETHER_INK; // ink

/** Simulated STT round-trip (ms) — replace with the real ai-service
 *  /v1/transcribe call when AE411b lands. */
const SIMULATED_STT_MS = 1400;

export interface AetherGenieSceneProps {
  /** Freeze the swirl rotation when OS Reduce Motion is on. */
  reducedMotion?: boolean;
}

/** `genieMicRingColor` returns web CSS `var(--..., #hex)` strings; RN
 *  can't parse `var()`. Pull the hex fallback (or pass a bare hex
 *  through). Defaults to terracotta if neither matches. */
function nativeColor(cssColor: string): string {
  const match = cssColor.match(/#[0-9a-fA-F]{6}/);
  return match ? match[0] : '#C2614A';
}

/** The particle swirl — denser rotation + glow when Genie is active. */
function GenieSwirl({
  active,
  reducedMotion,
}: {
  active: boolean;
  reducedMotion: boolean;
}): React.ReactElement {
  const pointsRef = useRef<Points>(null);
  const elapsedRef = useRef<number>(0);

  // A tight deterministic cloud for the swirl. Reuses the shared field
  // helper so the layout is consistent + testable.
  const positions = useMemo(
    () => ambientFieldPositionArray(GENIE_PARTICLE_COUNT * 4, { x: 3, y: 3, z: 3 }),
    [],
  );

  useFrame((_state, delta) => {
    if (reducedMotion) return;
    elapsedRef.current += delta;
    const pts = pointsRef.current;
    if (!pts) return;
    // Active: faster spin. Idle: a slow drift.
    const speed = active ? 0.6 : 0.12;
    pts.rotation.y = elapsedRef.current * speed;
    pts.rotation.x = Math.sin(elapsedRef.current * 0.2) * 0.15;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color={active ? PARTICLE_ACTIVE : PARTICLE_IDLE}
        size={active ? 0.07 : 0.05}
        sizeAttenuation
        transparent
        opacity={active ? 0.85 : 0.5}
      />
    </points>
  );
}

/**
 * The Genie surface scene. An R3F particle swirl background with an RN
 * mic-button overlay driven by the genie-state FSM.
 */
export function AetherGenieScene({
  reducedMotion = false,
}: AetherGenieSceneProps): React.ReactElement {
  const [state, setState] = useState<GenieState>('idle');
  // Mirror the state into a ref so the timer callbacks + the tap guard
  // read the live value without re-creating onMic or nesting setState
  // side effects (the source of the AE571 double-tap stall).
  const stateRef = useRef<GenieState>('idle');
  stateRef.current = state;
  const releaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sttTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (releaseTimer.current) clearTimeout(releaseTimer.current);
      if (sttTimer.current) clearTimeout(sttTimer.current);
    };
  }, []);

  // Tap = press + release for the demo: idle/transcribed/error -> listening,
  // then -> processing after 600ms, then a simulated STT -> transcribed.
  const onMic = useCallback(() => {
    // Ignore taps while a listening/processing cycle is already in flight
    // so an impatient double-tap can't cancel-and-reschedule the release
    // timer and pin the FSM in 'listening' (AE571).
    if (genieIsActive(stateRef.current)) return;
    const pressed = genieOnMicPress(stateRef.current);
    if (pressed !== 'listening') {
      setState(pressed);
      return;
    }
    setState('listening');
    if (releaseTimer.current) clearTimeout(releaseTimer.current);
    releaseTimer.current = setTimeout(() => {
      const processing = genieOnMicRelease(stateRef.current);
      setState(processing);
      if (processing !== 'processing') return;
      if (sttTimer.current) clearTimeout(sttTimer.current);
      sttTimer.current = setTimeout(() => setState(genieOnStt(stateRef.current)), SIMULATED_STT_MS);
    }, 600);
  }, []);

  const active = genieIsActive(state);
  const ringColor = nativeColor(genieMicRingColor(state));
  const label = genieStateLabel(state);

  return (
    <View style={styles.container} testID="aether-genie-scene">
      <Canvas camera={{ position: [0, 0, 7], fov: 60 }} style={styles.canvas}>
        <color attach="background" args={[BACKGROUND]} />
        <ambientLight intensity={0.8} />
        <GenieSwirl active={active} reducedMotion={reducedMotion} />
      </Canvas>

      <View style={styles.overlay} pointerEvents="box-none">
        <Text style={styles.stateLabel}>{label}</Text>
        <Pressable
          onPress={onMic}
          style={[styles.micButton, { borderColor: ringColor }]}
          accessibilityRole="button"
          accessibilityLabel={`Genie microphone, ${label}`}
        >
          <View style={[styles.micDot, { backgroundColor: ringColor }]} />
        </Pressable>
        <Text style={styles.hint}>
          {active ? 'Listening to the demo swirl…' : 'Tap to talk to Genie'}
        </Text>
      </View>
    </View>
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
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 64,
    gap: 16,
  },
  stateLabel: {
    fontSize: 22,
    fontWeight: '600',
    color: '#F2E8D5',
    textAlign: 'center',
  },
  micButton: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  hint: {
    fontSize: 13,
    color: '#9B8E7E',
    textAlign: 'center',
  },
});
