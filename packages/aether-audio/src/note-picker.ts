/**
 * Note picker — pure helpers for selecting pitches from a KeySignature.
 *
 * Two flavours:
 *   • `pickNoteRandom(key, rng)` — uniform random within the scale.
 *   • `pickNoteWeighted(key, rng, weights?)` — caller supplies per-pitch
 *     weights (often surface tempo-dependent — fast tempo prefers higher
 *     octaves). Defaults to weighting middle of the scale higher than the
 *     edges so confirms feel grounded.
 *
 * The picker takes an `rng() → number ∈ [0,1)` so tests can pass a
 * deterministic generator (mulberry32, same pattern as @app/web/lib/rng).
 *
 * No React, no Tone — these run in any consumer.
 */
import type { KeySignature, Pitch } from '@app/aether-motion/audio';

/** A deterministic, replayable PRNG suitable for note selection. */
export type Rng = () => number;

/** Uniform pick. Returns the tonic when the scale is empty (degenerate). */
export function pickNoteRandom(key: KeySignature, rng: Rng): Pitch {
  const scale = key.scale;
  if (scale.length === 0) return key.tonic;
  const r = clamp01Open(rng());
  const idx = Math.floor(r * scale.length);
  // The above can land on scale.length exactly when rng returns 1 (rare
  // but allowed by some generators); clamp.
  const safeIdx = idx >= scale.length ? scale.length - 1 : idx;
  return scale[safeIdx] as Pitch;
}

/** Weighted pick. `weights` must be same length as `key.scale`; non-finite
 *  / negative entries are treated as 0. When all weights are 0 we fall
 *  back to uniform pick so the caller never gets a runtime hang. */
export function pickNoteWeighted(
  key: KeySignature,
  rng: Rng,
  weights?: ReadonlyArray<number>,
): Pitch {
  const scale = key.scale;
  if (scale.length === 0) return key.tonic;
  const w = weights ?? bellWeights(scale.length);
  if (w.length !== scale.length) {
    return pickNoteRandom(key, rng);
  }
  let total = 0;
  for (let i = 0; i < w.length; i += 1) {
    const v = w[i];
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) total += v;
  }
  if (total === 0) return pickNoteRandom(key, rng);
  let r = clamp01Open(rng()) * total;
  for (let i = 0; i < w.length; i += 1) {
    const v = w[i];
    const piece = typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0;
    if (r < piece) return scale[i] as Pitch;
    r -= piece;
  }
  // Rounding fallback.
  return scale[scale.length - 1] as Pitch;
}

/** Returns a length-n weight array that bell-curves middle pitches higher
 *  than edges. Used as the default weighting in `pickNoteWeighted`. */
export function bellWeights(n: number): ReadonlyArray<number> {
  if (n <= 0) return [];
  if (n === 1) return [1];
  const out: number[] = new Array(n);
  const mid = (n - 1) / 2;
  for (let i = 0; i < n; i += 1) {
    const d = (i - mid) / Math.max(mid, 1);
    // 1 - d² is a parabolic bell capped at 1 at the centre, 0 at the edges.
    // We add a 0.2 floor so edges still have some chance.
    const v = Math.max(0.2, 1 - d * d);
    out[i] = v;
  }
  return out;
}

/** Clamp into [0, 1). Open at 1 so floor() never overflows the scale. */
function clamp01Open(r: number): number {
  if (!Number.isFinite(r)) return 0;
  if (r < 0) return 0;
  if (r >= 1) return 0.999999;
  return r;
}

/** Test-only exports. */
export const __testing = { clamp01Open };
