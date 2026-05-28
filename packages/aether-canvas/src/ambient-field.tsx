/**
 * <AmbientField> — procedural particle field.
 *
 * "Motes of dust catching light." 600 sprite-points distributed across
 * a 12×8×10 volume, drifting along a slow Lissajous curve driven by a
 * deterministic noise function. The field is intentionally NOT
 * physics-simulated — each particle reads its position from a closed
 * formula of (time, seed) so the field is bit-identical across
 * reloads, devices, and SSR snapshots. That determinism is what makes
 * Aether prototype videos look the same in every demo.
 *
 * Color: ochre-glow (warm, slight luminance) over the cream surface.
 * Reduced-motion: when `motionPolicy !== 'full'`, the field freezes at t=0.
 */
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { BufferAttribute, Points } from 'three';
import { useTheme, useMotionPolicy } from '@app/aether-core';

export interface AmbientFieldProps {
  /** Number of particles. Default 600 — anything more dilutes the magic. */
  count?: number;
  /** Volume bounds — particles stay inside this box. */
  bounds?: readonly [number, number, number];
  /** Per-particle size in world units. Default 0.04. */
  size?: number;
  /** Particle color override. Default theme.palette.ochre.glow. */
  color?: string;
  /** Drift speed multiplier. Default 1.0. */
  speed?: number;
}

/** Deterministic 1D noise — pure function of (i, dim) returns ∈ [-1, 1].
 *  Cheap hash, but seeded enough that 600 particles never visibly tile. */
function noise1(i: number, dim: number): number {
  // Mix coordinates into a single-precision sine; remap to [-1, 1].
  const k = i * 12.9898 + dim * 78.233;
  const s = Math.sin(k) * 43758.5453;
  return (s - Math.floor(s)) * 2 - 1;
}

export function AmbientField({
  count = 600,
  bounds = [12, 8, 10],
  size = 0.04,
  color,
  speed = 1.0,
}: AmbientFieldProps): React.ReactElement {
  const theme = useTheme();
  const motionPolicy = useMotionPolicy();
  const pointsRef = useRef<Points>(null);

  // Initial positions — closed form so SSR + first paint agree.
  const positions = useMemo<Float32Array>(() => {
    const arr = new Float32Array(count * 3);
    const [bx, by, bz] = bounds;
    for (let i = 0; i < count; i += 1) {
      arr[i * 3 + 0] = noise1(i, 0) * (bx / 2);
      arr[i * 3 + 1] = noise1(i, 1) * (by / 2);
      arr[i * 3 + 2] = noise1(i, 2) * (bz / 2);
    }
    return arr;
  }, [count, bounds]);

  // Per-particle phase so they drift independently.
  const phases = useMemo<Float32Array>(() => {
    const arr = new Float32Array(count);
    for (let i = 0; i < count; i += 1) {
      arr[i] = noise1(i, 7) * Math.PI;
    }
    return arr;
  }, [count]);

  useFrame((state) => {
    if (pointsRef.current === null) return;
    const points = pointsRef.current;
    const geom = points.geometry;
    const attr = geom.getAttribute('position') as BufferAttribute;
    const array = attr.array as Float32Array;
    // Freeze at t=0 when motion is suppressed.
    const t = motionPolicy === 'full' ? state.clock.elapsedTime * speed : 0;
    const [bx, by, bz] = bounds;
    for (let i = 0; i < count; i += 1) {
      // Position = base + slow Lissajous offset.
      const phase = phases[i]!;
      const baseX = noise1(i, 0) * (bx / 2);
      const baseY = noise1(i, 1) * (by / 2);
      const baseZ = noise1(i, 2) * (bz / 2);
      array[i * 3 + 0] = baseX + Math.sin(t * 0.21 + phase) * 0.45;
      array[i * 3 + 1] = baseY + Math.cos(t * 0.17 + phase * 1.3) * 0.35;
      array[i * 3 + 2] = baseZ + Math.sin(t * 0.13 + phase * 0.7) * 0.6;
    }
    attr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={size}
        color={color ?? theme.palette.ochre.glow}
        sizeAttenuation
        transparent
        opacity={0.65}
        depthWrite={false}
      />
    </points>
  );
}

/** Test export — verify deterministic positions without an R3F runtime. */
export const __testing = { noise1 };
