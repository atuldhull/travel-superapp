/**
 * AE300 — pure deterministic Fisher-Yates shuffle with an
 * injected RNG.
 *
 * Built on AE299 makeRng so a caller can pass `makeRng(dayOfYear)`
 * and get the same shuffle for the whole day. Returns a NEW array;
 * input is not mutated.
 *
 *   import { makeRng } from './random-seed';
 *   const rng = makeRng(42);
 *   const shuffled = shuffleWith(SUGGESTED_PROMPTS, rng);
 */

import type { SeededRng } from './random-seed';

export function shuffleWith<T>(items: ReadonlyArray<T>, rng: SeededRng): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.nextInt(i + 1);
    const a = out[i] as T;
    const b = out[j] as T;
    out[i] = b;
    out[j] = a;
  }
  return out;
}
