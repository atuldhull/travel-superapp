/**
 * AE299 — tiny deterministic seeded RNG (mulberry32).
 *
 * Math.random is non-deterministic, which is fine for trip-ID
 * salts (AE201) but hostile to anything that needs to look like
 * a "stable shuffle" between renders — e.g. picking 3 'Try one
 * of these' Pulse seed prompts (AE132) deterministically per day
 * + per user.
 *
 * 32-bit state, ~4.3B period — far more than enough for our
 * "pick a permutation per day" use case. Pure function — pass
 * the seed in, get a generator out.
 */

export interface SeededRng {
  /** Next number in the closed range [0, 1). */
  readonly next: () => number;
  /** Convenience: integer in [0, max). Returns 0 for max <= 0. */
  readonly nextInt: (max: number) => number;
  /** Convenience: pick one element from a non-empty array.
   *  Returns null for an empty input. */
  readonly pick: <T>(items: ReadonlyArray<T>) => T | null;
}

/** mulberry32 — small + fast + good enough. */
export function makeRng(seed: number): SeededRng {
  // Coerce + clamp the seed into a 32-bit integer.
  let s = (Number.isFinite(seed) ? Math.floor(seed) : 0) >>> 0;
  if (s === 0) s = 0x9e3779b9; // avoid pathological all-zero state
  const next = (): number => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const nextInt = (max: number): number => {
    if (!Number.isFinite(max) || max <= 0) return 0;
    return Math.floor(next() * Math.floor(max));
  };
  const pick = <T>(items: ReadonlyArray<T>): T | null => {
    if (items.length === 0) return null;
    return items[nextInt(items.length)] ?? null;
  };
  return { next, nextInt, pick };
}
