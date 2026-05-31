/**
 * <ParticleBurst> — one-shot directional particle scatter.
 *
 * Used during lifecycle transitions: a Surface materialises FROM a burst
 * collapsing inward, and dissolves INTO a burst scattering outward. The
 * geometry is deterministic (seeded mulberry-style noise) so SSR snapshots
 * stay stable. Differs from `<AmbientField>` which is continuous + idle —
 * burst is a one-shot animation gated on lifecycle phase.
 *
 * Three modes (driven by lifecycle phase, set by caller):
 *   - 'inward'  — particles fly from the bounds toward origin (materialising).
 *   - 'outward' — particles fly from origin toward the bounds (dissolving).
 *   - 'idle'    — particles render at the bounds, no motion.
 *
 * Pure motion math lives in `burstOffset()` so it's testable without R3F.
 */
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { BufferAttribute, Points } from 'three';
import { useTheme } from '@app/aether-core';

export type BurstMode = 'inward' | 'outward' | 'idle';

export interface ParticleBurstProps {
  /** Number of particles. Default 240 — enough for a felt scatter, light
   *  enough for low-end devices. */
  count?: number;
  /** Bounds radius — particles travel between origin and this distance. */
  radius?: number;
  /** Per-particle size in world units. */
  size?: number;
  /** Particle colour. Defaults to theme.palette.ochre.glow. */
  color?: string;
  /** Mode — wired by the consumer (typically to lifecycle phase). */
  mode: BurstMode;
  /** Progress 0..1 — the consumer feeds eased phase progress here. */
  progress: number;
}

/** Deterministic 1D noise (same as AmbientField). */
function noise1(i: number, dim: number): number {
  const k = i * 12.9898 + dim * 78.233;
  const s = Math.sin(k) * 43758.5453;
  return (s - Math.floor(s)) * 2 - 1;
}

/** Pure: compute the [x,y,z] offset for particle `i` given mode + progress
 *  + bounds radius. Tested without R3F. */
export function burstOffset(
  i: number,
  mode: BurstMode,
  progress: number,
  radius: number,
): readonly [number, number, number] {
  const dx = noise1(i, 0);
  const dy = noise1(i, 1);
  const dz = noise1(i, 2);
  const len = Math.max(Math.hypot(dx, dy, dz), 1e-6);
  const ux = dx / len;
  const uy = dy / len;
  const uz = dz / len;
  // t = 0 → origin, t = 1 → bounds.
  const t = mode === 'inward' ? 1 - clamp01(progress) : mode === 'outward' ? clamp01(progress) : 1;
  const r = radius * t;
  return [ux * r, uy * r, uz * r];
}

function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

export function ParticleBurst({
  count = 240,
  radius = 6,
  size = 0.05,
  color,
  mode,
  progress,
}: ParticleBurstProps): React.ReactElement {
  const theme = useTheme();
  const pointsRef = useRef<Points>(null);

  // Initial positions at the bounds (idle pose).
  const initial = useMemo<Float32Array>(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      const [x, y, z] = burstOffset(i, 'idle', 1, radius);
      arr[i * 3 + 0] = x;
      arr[i * 3 + 1] = y;
      arr[i * 3 + 2] = z;
    }
    return arr;
  }, [count, radius]);

  useFrame(() => {
    if (pointsRef.current === null) return;
    const attr = pointsRef.current.geometry.getAttribute('position') as BufferAttribute;
    const array = attr.array as Float32Array;
    for (let i = 0; i < count; i += 1) {
      const [x, y, z] = burstOffset(i, mode, progress, radius);
      array[i * 3 + 0] = x;
      array[i * 3 + 1] = y;
      array[i * 3 + 2] = z;
    }
    attr.needsUpdate = true;
  });

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
        size={size}
        color={color ?? theme.palette.ochre.glow}
        sizeAttenuation
        transparent
        opacity={0.85}
        depthWrite={false}
      />
    </points>
  );
}

/** Test export — verify burstOffset shape without an R3F runtime. */
export const __testing = { noise1, clamp01 };
