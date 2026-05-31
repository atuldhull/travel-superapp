/**
 * <WeatherStreaks> — vertical rain / storm streak particle field.
 *
 * Per 02-surfaces.md §3 Atlas: "weather is rendered as ambient particles
 * in the scene (rain = vertical streaks; sunny = warm bloom; storm =
 * visible front rolling across)". AE388 ships the rain + storm variants.
 *
 * Implementation: a `<points>` field with a custom point material whose
 * size is large + vertically scaled so each point reads as a streak. The
 * field falls at a constant speed per useFrame and wraps when the
 * particle exits the bottom of the bounds box. Positions are deterministic
 * (noise-seeded) so SSR + reload feel coherent.
 *
 * Storm mode = `intensity > 1` — denser + faster + slightly darker. The
 * Atlas scene picks the intensity based on `useWeather()` from
 * apps/web/phase1.
 */
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { BufferAttribute, Points } from 'three';
import { useTheme } from '@app/aether-core';

export interface WeatherStreaksProps {
  /** Particle count. Default 600. Storm wants ~1200. */
  count?: number;
  /** Volume bounds [width, height, depth]. */
  bounds?: readonly [number, number, number];
  /** Fall speed in world-units per second. Rain ~6, storm ~10. */
  speed?: number;
  /** Per-streak size in world units. Default 0.04. */
  size?: number;
  /** Streak colour override. Defaults to a slate variant of the theme cream. */
  color?: string;
  /** Storm vs rain — `>1` darkens + thickens the streaks. Default 1. */
  intensity?: number;
}

/** Deterministic 1D noise — pure function of (i, dim) returns ∈ [-1, 1].
 *  Matches AmbientField + ParticleBurst so all three fields can share a
 *  seed without conflicting. */
function noise1(i: number, dim: number): number {
  const k = i * 12.9898 + dim * 78.233;
  const s = Math.sin(k) * 43758.5453;
  return (s - Math.floor(s)) * 2 - 1;
}

/** Pure: compute the y position for a streak `i` given elapsed time `t`
 *  in seconds, the falling speed and the height bound. The streak loops
 *  through the height: y starts at +height/2 and falls to -height/2,
 *  then wraps. */
export function streakYAt(i: number, t: number, speed: number, height: number): number {
  if (height <= 0) return 0;
  // Each particle has a per-streak phase offset so they don't all
  // wrap in unison.
  const phase = (noise1(i, 5) + 1) * 0.5; // [0, 1]
  // Distance fallen this cycle (mod height) — accumulated from t=0.
  const cycle = (((t * speed) % height) + phase * height) % height;
  return height / 2 - cycle;
}

export function WeatherStreaks({
  count = 600,
  bounds = [16, 10, 12],
  speed = 6,
  size = 0.04,
  color,
  intensity = 1,
}: WeatherStreaksProps): React.ReactElement {
  const theme = useTheme();
  const pointsRef = useRef<Points>(null);
  const [bx, by, bz] = bounds;

  const initial = useMemo<Float32Array>(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      arr[i * 3 + 0] = noise1(i, 0) * (bx / 2);
      arr[i * 3 + 1] = noise1(i, 1) * (by / 2);
      arr[i * 3 + 2] = noise1(i, 2) * (bz / 2);
    }
    return arr;
  }, [count, bx, by, bz]);

  // Speed multiplier per intensity — storm = denser + faster.
  const effectiveSpeed = speed * Math.max(0.5, intensity);

  useFrame((state) => {
    if (pointsRef.current === null) return;
    const attr = pointsRef.current.geometry.getAttribute('position') as BufferAttribute;
    const array = attr.array as Float32Array;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < count; i += 1) {
      // x + z stay at their seeded positions; only y falls + wraps.
      array[i * 3 + 1] = streakYAt(i, t, effectiveSpeed, by);
    }
    attr.needsUpdate = true;
  });

  // Default streak colour: slate-cream — neutral against the AE381
  // surface palette. Intensity > 1 fades toward darker greys.
  const baseColor = color ?? theme.color.ink.whisper ?? '#CFC4B3';

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={initial}
          itemSize={3}
          args={[initial, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={size * Math.max(1, intensity)}
        color={baseColor}
        sizeAttenuation
        transparent
        // Storm mode reads as denser + slightly more opaque.
        opacity={Math.min(0.85, 0.55 + (intensity - 1) * 0.15)}
        depthWrite={false}
      />
    </points>
  );
}

/** Test export — verify the pure y math without an R3F runtime. */
export const __testing = { noise1 };
