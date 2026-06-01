/**
 * AE412 — pure helpers for the Genie particle dissolution overlay.
 *
 * Per docs/aether/02-surfaces.md §2 Genie: "the current surface
 * dissolves into ~5000 particles that swirl into the lower third."
 * AE412 ships the OVERLAY half of that contract — ~120 small SVG
 * particles that swirl into a "lower third" swarm when the modal
 * opens and dissolve back out on close. The full 5000-particle GPU
 * version lands once the Genie modal lifts into the R3F canvas
 * (the modal today is a DOM overlay, so SVG is the honest first cut).
 *
 * Pure — no React, no DOM. The component reads these to compute the
 * per-particle (cx, cy, r, opacity) tuple every animation frame.
 */

/** Number of particles in the swarm. SVG-friendly: anything above ~200
 *  starts to hurt frame budget; 120 reads as "a dust cloud" without
 *  burning paint cycles. The full GPU version lifts this to 5000. */
export const GENIE_PARTICLE_COUNT = 120;

/** Default base radius (px) for each particle. The actual radius is
 *  modulated per particle via `particleRadius(i)` so the swarm doesn't
 *  read as uniform pinpoints. */
export const GENIE_PARTICLE_BASE_RADIUS = 2.2;

/** Duration of the open / close dissolve transition (ms). Long enough
 *  to feel deliberate, short enough not to delay the modal action. */
export const GENIE_DISSOLVE_MS = 850;

/** Deterministic per-particle 32-bit hash seed. Combines `i` with a
 *  large odd multiplier so adjacent indices don't share patterns. */
function seedFor(i: number): number {
  // 0x9E3779B1 ≈ 2^32 / golden ratio — a common hash spread.
  return ((i * 0x9e3779b1) ^ ((i + 1) * 0x85ebca77)) >>> 0;
}

/** Splitmix32-style 1-call deterministic PRNG. Returns a number in
 *  [0, 1). Pure: pass the seed in, no global state. */
function rand(seed: number, salt: number): number {
  let x = (seed + salt * 0x9e3779b1) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0;
  x = (x ^ (x >>> 16)) >>> 0;
  return (x % 1_000_000) / 1_000_000;
}

/** Per-particle radius (px). Most particles sit near base, a long
 *  tail produces a few larger highlights so the swarm reads as
 *  layered dust, not uniform pinpoints. */
export function particleRadius(i: number, base: number = GENIE_PARTICLE_BASE_RADIUS): number {
  const seed = seedFor(i);
  const t = rand(seed, 17);
  // Cubic falloff: most particles base × 1.0, occasional × 2.0.
  return base * (0.6 + Math.pow(t, 3) * 1.6);
}

/** Per-particle opacity (0..1) at the "swirled" rest pose. Lower
 *  opacity for some particles makes the swarm feel deeper. */
export function particleRestOpacity(i: number): number {
  const seed = seedFor(i);
  const t = rand(seed, 41);
  return 0.35 + t * 0.45;
}

/** Initial (pre-swirl) position for particle `i` — scattered across
 *  the FULL viewport so the dissolution reads as "every pixel
 *  contributes a particle". Deterministic. */
export function particleInitialPosition(
  i: number,
  width: number,
  height: number,
): { x: number; y: number } {
  const seed = seedFor(i);
  return {
    x: rand(seed, 3) * width,
    y: rand(seed, 7) * height,
  };
}

/** Resting (post-swirl) position for particle `i` — clustered into a
 *  ring in the lower third. Angle distributed evenly so the ring
 *  looks dense and uniform; radius jittered so it has thickness. */
export function particleRestPosition(
  i: number,
  width: number,
  height: number,
  total: number = GENIE_PARTICLE_COUNT,
  ringRadius?: number,
): { x: number; y: number } {
  const cx = width / 2;
  const cy = (height * 2) / 3;
  const baseR = ringRadius ?? Math.min(width, height) * 0.18;
  const angle = (i / Math.max(1, total)) * Math.PI * 2;
  const seed = seedFor(i);
  // Thickness ± 24 px so the ring has dust on both sides.
  const rJitter = (rand(seed, 11) - 0.5) * 48;
  const r = baseR + rJitter;
  return {
    x: cx + Math.cos(angle) * r,
    y: cy + Math.sin(angle) * r,
  };
}

/** Ease-in-out cubic. Smoother than linear; symmetrical so open / close
 *  feel the same. */
export function easeInOutCubic(t: number): number {
  if (!Number.isFinite(t)) return 0;
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Compute the live position + opacity for particle `i` at progress
 *  `t ∈ [0, 1]` — `t=0` is fully scattered (modal closed), `t=1` is
 *  fully swirled (modal open). The close transition runs t backward. */
export function particleAt(
  i: number,
  t: number,
  width: number,
  height: number,
  total: number = GENIE_PARTICLE_COUNT,
): { x: number; y: number; opacity: number } {
  const e = easeInOutCubic(t);
  const start = particleInitialPosition(i, width, height);
  const end = particleRestPosition(i, width, height, total);
  const rest = particleRestOpacity(i);
  return {
    x: start.x + (end.x - start.x) * e,
    y: start.y + (end.y - start.y) * e,
    // Fade in to rest opacity as we swirl. At t=0 the particles are
    // invisible (so the page below stays uncluttered).
    opacity: e * rest,
  };
}

/** Resolve the canvas dimensions to use. Returns a sensible default
 *  when the host environment hasn't provided real dimensions yet
 *  (e.g. SSR or first paint). */
export function canvasDimensions(
  width: number | null | undefined,
  height: number | null | undefined,
): { width: number; height: number } {
  const w = Number.isFinite(width as number) && (width as number) > 0 ? (width as number) : 1024;
  const h = Number.isFinite(height as number) && (height as number) > 0 ? (height as number) : 768;
  return { width: w, height: h };
}
