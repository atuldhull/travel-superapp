/**
 * AE414 — pure helpers for the Vault R3F floating-glyph scene.
 *
 * Per docs/aether/02-surfaces.md §8 Vault: "prices float as weighted
 * glyphs". AE407 shipped the 2D HTML overlay; AE414 adds the R3F scene
 * that actually puts the glyphs into 3D space — each glyph is a sphere
 * on a horizontal ring, sized by amount, gently bobbing.
 *
 * Pure — no React, no R3F. The scene calls these helpers from useMemo
 * + useFrame; tests pin the math.
 */
import type { Vec3Tuple } from '@app/aether-canvas';

/** Default ring radius (world units). The Phase 1 SurfaceCanvas
 *  camera sits at z=6 looking at the origin; radius 4 keeps the ring
 *  comfortably in view without crowding the centre. */
export const DEFAULT_VAULT_RING_RADIUS = 4;

/** Default float amplitude (world units). 0.18 reads as "the glyph
 *  hovers" without looking like a metronome. */
export const DEFAULT_VAULT_FLOAT_AMPLITUDE = 0.18;

/** Default float frequency (radians per second). 1.4 → ~4.5 second
 *  full oscillation. */
export const DEFAULT_VAULT_FLOAT_FREQUENCY = 1.4;

/** Per-glyph base sphere scale before AE407 amount weighting. */
export const DEFAULT_VAULT_BASE_SCALE = 0.55;

/** Phase shift (radians) added per glyph index so the ring doesn't
 *  bob in lock-step. 0.7 ≈ 40° between neighbours. */
export const DEFAULT_VAULT_PHASE_OFFSET = 0.7;

/** Glyph position on a horizontal ring of `radius` in the XZ plane.
 *  Index 0 sits at (+radius, 0, 0); subsequent glyphs walk
 *  counter-clockwise (looking down). Returns the rest pose — the per-
 *  frame bob lifts Y via `glyphFloatY`. */
export function glyphRingPosition(
  index: number,
  total: number,
  radius: number = DEFAULT_VAULT_RING_RADIUS,
): Vec3Tuple {
  const safeTotal = Math.max(1, total);
  const angle = (index / safeTotal) * Math.PI * 2;
  return [Math.cos(angle) * radius, 0, Math.sin(angle) * radius];
}

/** Vertical bob offset for glyph `index` at time `t` (seconds). Each
 *  glyph is phase-shifted so they don't move as a single block. Pure —
 *  no useFrame, no R3F. */
export function glyphFloatY(
  index: number,
  timeSeconds: number,
  amplitude: number = DEFAULT_VAULT_FLOAT_AMPLITUDE,
  frequency: number = DEFAULT_VAULT_FLOAT_FREQUENCY,
  phaseOffset: number = DEFAULT_VAULT_PHASE_OFFSET,
): number {
  if (!Number.isFinite(timeSeconds)) return 0;
  const phase = index * phaseOffset;
  return Math.sin(timeSeconds * frequency + phase) * amplitude;
}

/** Scale factor for the glyph's sphere. Maps `amountMinor` linearly
 *  across `[minAmount, maxAmount]` to `[0.7×base, 1.3×base]`. A
 *  degenerate range (min == max) returns `base` so the ring still
 *  looks balanced. */
export function glyphSphereScale(
  amountMinor: number,
  minAmount: number,
  maxAmount: number,
  base: number = DEFAULT_VAULT_BASE_SCALE,
): number {
  if (!Number.isFinite(amountMinor) || !Number.isFinite(minAmount) || !Number.isFinite(maxAmount)) {
    return base;
  }
  if (maxAmount <= minAmount) return base;
  const t = (amountMinor - minAmount) / (maxAmount - minAmount);
  const clamped = Math.max(0, Math.min(1, t));
  return base * (0.7 + clamped * 0.6);
}

/** Halo intensity for the "price dropped recently" glow. Pure: the
 *  scene multiplies its emissive intensity by this so the halo is
 *  consistently 0 when no drop or `intensity` when there was one. */
export function glyphHaloIntensity(dropped: boolean, intensity: number = 0.35): number {
  return dropped ? intensity : 0;
}
