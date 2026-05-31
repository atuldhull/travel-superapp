/**
 * `useSurfaceKey` — exposes the current Surface's key signature.
 *
 * AE376 takes the key from a Surface-level metadata attribute when set,
 * falling back to a destination-slug lookup when the Surface exposes a
 * `data.destinationSlug` field. If neither is present, the locked Italian
 * default is returned so callers never need to null-check.
 *
 * In Phase 2+ this hook will also weight the key by the user's current
 * trip context (current destination on the trip board) — the contract
 * here is stable so consumers can adopt early.
 */
import { useCurrentSurface } from '@app/aether-core';
import { italianKey, type KeySignature } from '@app/aether-motion/audio';
import { keySignatureFor } from './destination-keys';

/**
 * Reads the active Surface's destination-keyed signature. Caller can
 * override per render by passing a slug; otherwise we use the Surface's
 * `keySignature` (literal Tone.js note name) if it's a known curated
 * destination, else fall back to the Italian default.
 *
 * The Surface model's `keySignature` field (AE374) holds an opaque string
 * — for the Phase 1 prototype we interpret it as a destination slug. The
 * proper KeySignature object is resolved here.
 */
export function useSurfaceKey(slugOverride?: string | null): KeySignature {
  const current = useCurrentSurface();
  if (typeof slugOverride === 'string' && slugOverride !== '') {
    return keySignatureFor(slugOverride);
  }
  if (current === null) return italianKey;
  // Surface.keySignature is the slug-as-string (Phase 1 convention);
  // Phase 6 will move to a typed enum but that change is additive.
  if (typeof current.keySignature === 'string' && current.keySignature !== '') {
    return keySignatureFor(current.keySignature);
  }
  return italianKey;
}
