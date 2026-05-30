/**
 * AE227 — numeric clamp utility.
 *
 * Used widely across Aether for things like:
 *   - reading-progress fill (clamp(scrollY/total, 0, 1))
 *   - share-card font size (clamp(110, longTitle, 72))
 *   - Atlas radius slider (clamp(km, 1, 200))
 *
 * Defends against:
 *   - NaN input → returns NaN (no silent corruption)
 *   - min > max → swaps so the closed interval is well-formed
 */

export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return Number.NaN;
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  if (value < lo) return lo;
  if (value > hi) return hi;
  return value;
}

/** Convenience for the common [0, 1] case. */
export function clamp01(value: number): number {
  return clamp(value, 0, 1);
}
