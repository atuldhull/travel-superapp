/**
 * `<AetherPulseGlow/>` — the first Aether mobile surface (Phase 4 AE526).
 *
 * Per `docs/aether/02-surfaces.md` section 7 Pulse + the AR-locked
 * renderer policy (`@app/aether-canvas-native/src/renderer-policy.ts`,
 * Phase 4 decision #2): Pulse is a flat surface that renders with
 * **Skia** rather than R3F-native.
 *
 * This component is the mobile analog of the web's
 * `apps/web/src/components/aether/phase1/pulse-fab.tsx`. It paints a
 * 64-px corner glow with a breathing scale + opacity envelope derived
 * from the **same pure helper** the web uses:
 * `pulseBreathAt(mood, tMs)` from `@app/aether-canvas-shared`. The
 * web R3F Pulse + this mobile Skia Pulse are mathematically
 * identical — AE489's invariants spec pins the bounds for both.
 *
 * AE526 ships the lowest-risk Phase 4 surface first:
 *   - No surface manager wiring yet (mood is a prop; default 'idle').
 *     Once `@app/aether-core-native` is consumed by mobile we'll wire
 *     `moodFromPhase(useSurfaceLifecycle().phase)`.
 *   - No audio coupling yet (Genie ports later).
 *   - No "hold to talk" gesture (lands when Genie lands).
 *
 * The component mounts as an absolutely-positioned overlay at the
 * bottom-right corner of whatever route it's nested under. Mount it
 * once in `app/_layout.tsx` so it persists across navigation (the
 * always-present requirement from the surface doc).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { Canvas, Circle, Group } from '@shopify/react-native-skia';
import { pulseBreathAt, type PulseMood } from '@app/aether-canvas-shared';
import { AETHER_ACCENT, AETHER_GLOW } from './palette';

/** Glow box edge length (px) including breathing headroom. The Skia
 *  canvas is sized to this; the painted circle's radius is half of
 *  this times the breathing scale. 88 px is the 64-px UX target
 *  rounded up to leave headroom for the `scaleMax` 1.15 of
 *  `'listening'` mood without clipping the glow at the canvas edge. */
const GLOW_BOX_PX = 88;

/** Base circle radius (px) before the breathing scale is applied.
 *  64 / 2 = 32 — matches the docs' 64-px Pulse target. */
const GLOW_BASE_RADIUS_PX = 32;

/** Margin from the screen edges (px). 24 keeps Pulse comfortably
 *  clear of the OS safe-area inset on iOS/Android. */
const GLOW_EDGE_MARGIN_PX = 24;

/** Warm Italian terracotta + ochre — the locked AE accent + glow. */
const GLOW_FILL = AETHER_ACCENT;
const GLOW_GLOW = AETHER_GLOW;

export interface AetherPulseGlowProps {
  /** Override the breathing mood. Defaults to 'idle' (gentle 8s cycle).
   *  Future: derive from `useSurfaceLifecycle()` once aether-core-native
   *  is wired in. */
  mood?: PulseMood;
  /** Disable the breathing animation entirely. Honoured for
   *  reduced-motion preferences. The static `<Circle>` still paints
   *  at the mood's mid-range scale + opacity. */
  reducedMotion?: boolean;
  /** Optional override for the absolute-position style. Defaults to
   *  bottom-right with `GLOW_EDGE_MARGIN_PX` inset. */
  positionStyle?: ViewStyle;
}

/**
 * Always-present Pulse glow. Drives a Skia `<Circle>` from the
 * canvas-shared `pulseBreathAt(mood, t)` helper.
 *
 * The component owns its own `requestAnimationFrame` loop so the
 * surface manager wiring stays loose — drop it anywhere a `<View>`
 * fits. Once `@app/aether-core-native` consumes the surface manager
 * on mobile, this loop will switch to reading from the manager's
 * clock (so multiple Pulse mounts stay phase-locked).
 */
export function AetherPulseGlow({
  mood = 'idle',
  reducedMotion = false,
  positionStyle,
}: AetherPulseGlowProps): React.ReactElement {
  const startRef = useRef<number | null>(null);
  const [now, setNow] = useState<number>(0);

  useEffect(() => {
    if (reducedMotion) return undefined;
    let frameHandle = 0;
    const tick = (t: number): void => {
      if (startRef.current === null) startRef.current = t;
      setNow(t - startRef.current);
      frameHandle = requestAnimationFrame(tick);
    };
    frameHandle = requestAnimationFrame(tick);
    return () => {
      if (frameHandle) cancelAnimationFrame(frameHandle);
      startRef.current = null;
    };
  }, [reducedMotion]);

  const { scale, opacity } = useMemo(() => {
    if (reducedMotion) {
      // Mid-range static envelope — readable + non-distracting.
      return pulseBreathAt(mood, 0);
    }
    return pulseBreathAt(mood, now);
  }, [mood, now, reducedMotion]);

  const radius = GLOW_BASE_RADIUS_PX * scale;
  const center = GLOW_BOX_PX / 2;
  const glowRadius = radius * 1.6;
  const glowOpacity = Math.max(0, opacity * 0.5);

  return (
    <View
      pointerEvents="none"
      style={[styles.container, positionStyle]}
      testID="aether-pulse-glow"
      accessibilityRole="image"
      accessibilityLabel="Aether Pulse"
    >
      <Canvas style={styles.canvas}>
        <Group>
          {/* Soft outer glow halo */}
          <Circle cx={center} cy={center} r={glowRadius} color={GLOW_GLOW} opacity={glowOpacity} />
          {/* Inner solid sphere */}
          <Circle cx={center} cy={center} r={radius} color={GLOW_FILL} opacity={opacity} />
        </Group>
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: GLOW_EDGE_MARGIN_PX,
    bottom: GLOW_EDGE_MARGIN_PX,
    width: GLOW_BOX_PX,
    height: GLOW_BOX_PX,
  },
  canvas: {
    width: GLOW_BOX_PX,
    height: GLOW_BOX_PX,
  },
});

/** Re-export the constants so downstream layout code (safe-area + nav
 *  bar adjusters) can avoid Pulse without hard-coding the magic numbers. */
export const AETHER_PULSE_GLOW_BOX_PX = GLOW_BOX_PX;
export const AETHER_PULSE_GLOW_EDGE_MARGIN_PX = GLOW_EDGE_MARGIN_PX;
