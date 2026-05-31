/**
 * Per-destination key signatures.
 *
 * Architecture (01-architecture.md §Audio layer) calls for a per-region key
 * the surface drone sits in — Tokyo = G♭ minor dreamy, Lisbon = D major warm,
 * etc. For the Indian super-app we choose evocative keys per region:
 *
 *   - Leh / Ladakh:        C minor pentatonic, slow — austere mountain air.
 *   - Spiti:               A minor, slow — high-desert breath.
 *   - Goa (Anjuna):        D major, mid — beach + bass.
 *   - Kerala (Alleppey):   F lydian, slow — backwaters glide.
 *   - Rajasthan (Jaipur):  E phrygian dominant, mid — Mughal heat.
 *   - Varanasi:            G dorian, slow — ghat mysticism.
 *   - Darjeeling:          A♭ major, mid — tea-garden lift.
 *   - Andaman:             E major, slow — ocean wide.
 *   - Coorg:               E minor pentatonic, slow — coffee mist.
 *   - Hampi:               D phrygian, slow — ruin stillness.
 *
 * The keys are taken from `@app/aether-motion/audio`'s `KeySignature` type
 * so the audio package stays a tokens consumer, not a re-definer. A
 * surface that doesn't yet have its own key falls back to `italianKey`
 * (the locked default from AE1).
 *
 * Pure data — no React, no Tone. The React layer in `surface-audio-layer.tsx`
 * looks slugs up here. New destinations are append-only (no existing slug
 * gets its key changed without a 06-decisions.md update).
 */
import { italianKey, type KeySignature, type Pitch } from '@app/aether-motion/audio';

/** Every supported slug uses lowercase kebab-case (same convention as
 *  the destinations catalog in apps/web). */
export type DestinationSlug = string;

/** Build a key from a tonic + scale degrees (semitone offsets) + tempo. */
function buildKey(tonic: Pitch, scale: ReadonlyArray<Pitch>, tempo: number): KeySignature {
  return { tonic, scale, tempo };
}

/** C minor pentatonic — slow + austere. Tonic C3 keeps the drone low. */
const cMinorPentaSlow: KeySignature = buildKey(
  'C3',
  ['C3', 'D3', 'F3', 'G3', 'A3', 'C4', 'D4', 'F4', 'G4'],
  56,
);

/** A natural minor — slow, breathing. */
const aMinorSlow: KeySignature = buildKey(
  'A2',
  ['A2', 'C3', 'D3', 'E3', 'G3', 'A3', 'C4', 'D4', 'E4'],
  56,
);

/** D major — sunny, mid-tempo. */
const dMajorMid: KeySignature = buildKey(
  'D3',
  ['D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'D4', 'E4', 'F4'],
  76,
);

/** F lydian — sustained backwaters glide. The lifted #4 (B natural) is
 *  what makes this feel like water + light. */
const fLydianSlow: KeySignature = buildKey(
  'F3',
  ['F3', 'G3', 'A3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G4'],
  60,
);

/** E phrygian dominant — Mughal-flavoured, mid. */
const ePhrygianDominantMid: KeySignature = buildKey(
  'E3',
  ['E3', 'F3', 'G3', 'A3', 'B3', 'C4', 'D4', 'E4'],
  80,
);

/** G dorian — Varanasi ghat mysticism, slow. */
const gDorianSlow: KeySignature = buildKey(
  'G3',
  ['G3', 'A3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G4'],
  58,
);

/** A♭ major — Darjeeling lift. Mid. */
const aFlatMajorMid: KeySignature = buildKey(
  'A3',
  ['A3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4'],
  72,
);

/** E major — ocean-wide, slow. */
const eMajorSlow: KeySignature = buildKey(
  'E3',
  ['E3', 'F3', 'G3', 'A3', 'B3', 'C4', 'D4', 'E4'],
  62,
);

/** E minor pentatonic — coffee mist, slow. */
const eMinorPentaSlow: KeySignature = buildKey(
  'E3',
  ['E3', 'G3', 'A3', 'B3', 'D4', 'E4', 'G4', 'A4'],
  60,
);

/** D phrygian — Hampi ruin stillness, slow. */
const dPhrygianSlow: KeySignature = buildKey(
  'D3',
  ['D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4', 'D4'],
  56,
);

/** Source-of-truth map. Append-only. */
export const DESTINATION_KEYS: Readonly<Record<string, KeySignature>> = Object.freeze({
  leh: cMinorPentaSlow,
  ladakh: cMinorPentaSlow,
  spiti: aMinorSlow,
  anjuna: dMajorMid,
  goa: dMajorMid,
  alleppey: fLydianSlow,
  kerala: fLydianSlow,
  jaipur: ePhrygianDominantMid,
  rajasthan: ePhrygianDominantMid,
  varanasi: gDorianSlow,
  darjeeling: aFlatMajorMid,
  andaman: eMajorSlow,
  coorg: eMinorPentaSlow,
  hampi: dPhrygianSlow,
});

/** Look up the key signature for a slug. Case-insensitive. Falls back to
 *  the locked Italian default when the slug isn't in the catalogue. */
export function keySignatureFor(slug: DestinationSlug | null | undefined): KeySignature {
  if (typeof slug !== 'string' || slug === '') return italianKey;
  const key = DESTINATION_KEYS[slug.toLowerCase()];
  return key ?? italianKey;
}

/** True iff this slug has a curated (non-fallback) key signature. */
export function hasCuratedKey(slug: DestinationSlug | null | undefined): boolean {
  if (typeof slug !== 'string' || slug === '') return false;
  return slug.toLowerCase() in DESTINATION_KEYS;
}

/** All slugs that have curated keys. Stable order = insertion order
 *  (Object.keys on an object literal). */
export function curatedSlugs(): ReadonlyArray<DestinationSlug> {
  return Object.keys(DESTINATION_KEYS);
}
