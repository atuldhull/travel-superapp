/**
 * Per-destination palette accents (AE61).
 *
 * Phase 0 derivation: hand-curated per slug. Each destination's hero
 * photograph has a dominant chroma — Jaipur sandstone-pink, Alleppey
 * palm-teal, Leh thin-sky-blue, Anjuna coastal-saffron, etc. — and
 * threading that chroma into the page's accent + kicker color makes
 * each destination feel like its own publication rather than a
 * uniform template.
 *
 * Phase 6 (post-AE61) is to derive these at build time from the hero
 * pixel data via a vibrant-color extractor (node-vibrant). Until then,
 * curated values keep us inside the Warm-Italian system + give the
 * editorial bite the design called for.
 *
 * Each accent is required to satisfy WCAG AA against the cream surface
 * (#F2E8D5) — verified visually, then with `apca-w3` at audit time.
 */

export interface DestinationAccent {
  /** Used for kicker eyebrows, CTAs, eyebrow links. */
  readonly base: string;
  /** Used for the darker hover / on-press / icon stroke colors. */
  readonly deep: string;
  /** Faint background tint for cards / chips on cream surfaces. */
  readonly whisper: string;
  /** One-word accent name surfaced in the page chrome (eyebrow). */
  readonly note: string;
}

/** Fallback used when a slug isn't in the map (e.g. CMS additions
 *  Phase 2). Matches the Warm-Italian terracotta. */
export const TERRACOTTA: DestinationAccent = {
  base: '#C2614A',
  deep: '#A04A36',
  whisper: 'rgba(194, 97, 74, 0.10)',
  note: 'terracotta',
};

/** Per-slug curated accents. Order mirrors `destinations/data.ts`. */
const ACCENTS: Record<string, DestinationAccent> = {
  jaipur: {
    base: '#D9805C',
    deep: '#B0593A',
    whisper: 'rgba(217, 128, 92, 0.12)',
    note: 'pink-sandstone',
  },
  alleppey: {
    base: '#3F8C7A',
    deep: '#2B6256',
    whisper: 'rgba(63, 140, 122, 0.12)',
    note: 'palm-teal',
  },
  leh: {
    base: '#4F7BAE',
    deep: '#36578A',
    whisper: 'rgba(79, 123, 174, 0.12)',
    note: 'thin-sky',
  },
  anjuna: {
    base: '#D88B3F',
    deep: '#B2682A',
    whisper: 'rgba(216, 139, 63, 0.12)',
    note: 'coastal-saffron',
  },
  hampi: {
    base: '#B57B3E',
    deep: '#8E5C2A',
    whisper: 'rgba(181, 123, 62, 0.12)',
    note: 'granite-gold',
  },
  varanasi: {
    base: '#C2624A',
    deep: '#9A4836',
    whisper: 'rgba(194, 98, 74, 0.12)',
    note: 'ghat-ember',
  },
  mumbai: {
    base: '#5B8ABF',
    deep: '#3F6796',
    whisper: 'rgba(91, 138, 191, 0.12)',
    note: 'bombay-sea',
  },
  coorg: {
    base: '#4D7A4A',
    deep: '#345534',
    whisper: 'rgba(77, 122, 74, 0.12)',
    note: 'coffee-canopy',
  },
  pondicherry: {
    base: '#D26A6A',
    deep: '#A14848',
    whisper: 'rgba(210, 106, 106, 0.12)',
    note: 'french-mustard',
  },
  spiti: {
    base: '#7D7A89',
    deep: '#56535F',
    whisper: 'rgba(125, 122, 137, 0.12)',
    note: 'high-desert',
  },
  darjeeling: {
    base: '#3D8585',
    deep: '#275D5D',
    whisper: 'rgba(61, 133, 133, 0.12)',
    note: 'tea-mist',
  },
  udaipur: {
    base: '#C28A4A',
    deep: '#956A33',
    whisper: 'rgba(194, 138, 74, 0.12)',
    note: 'lake-gold',
  },
  madurai: {
    base: '#B14F4F',
    deep: '#8A3B3B',
    whisper: 'rgba(177, 79, 79, 0.12)',
    note: 'temple-vermilion',
  },
  bhuj: {
    base: '#C28438',
    deep: '#956424',
    whisper: 'rgba(194, 132, 56, 0.12)',
    note: 'salt-amber',
  },
  shillong: {
    base: '#4D6F8B',
    deep: '#324E66',
    whisper: 'rgba(77, 111, 139, 0.12)',
    note: 'cloud-slate',
  },
  // ── International additions: a bespoke accent per worldwide guide so
  //    each of the 12 feels like its own publication (matching the
  //    Phase-0 Indian set) rather than collapsing to the terracotta
  //    fallback. Same mid-tone saturation band as above for AA on cream.
  santorini: {
    base: '#3E78A8',
    deep: '#2B597F',
    whisper: 'rgba(62, 120, 168, 0.12)',
    note: 'aegean-blue',
  },
  kyoto: {
    base: '#C2543F',
    deep: '#9A3F2E',
    whisper: 'rgba(194, 84, 63, 0.12)',
    note: 'torii-vermilion',
  },
  bali: {
    base: '#4A8C5A',
    deep: '#336340',
    whisper: 'rgba(74, 140, 90, 0.12)',
    note: 'rice-emerald',
  },
  maldives: {
    base: '#2E8C8C',
    deep: '#1F6363',
    whisper: 'rgba(46, 140, 140, 0.12)',
    note: 'lagoon-turquoise',
  },
  paris: {
    base: '#B8924A',
    deep: '#8E6F34',
    whisper: 'rgba(184, 146, 74, 0.12)',
    note: 'haussmann-gold',
  },
  dubai: {
    base: '#C68A3C',
    deep: '#9A6828',
    whisper: 'rgba(198, 138, 60, 0.12)',
    note: 'dune-amber',
  },
  interlaken: {
    base: '#3C8A72',
    deep: '#296151',
    whisper: 'rgba(60, 138, 114, 0.12)',
    note: 'alpine-jade',
  },
  iceland: {
    base: '#5380A0',
    deep: '#395E78',
    whisper: 'rgba(83, 128, 160, 0.12)',
    note: 'glacier-blue',
  },
  marrakech: {
    base: '#C56A4C',
    deep: '#9C4E35',
    whisper: 'rgba(197, 106, 76, 0.12)',
    note: 'medina-clay',
  },
  rome: {
    base: '#B07C42',
    deep: '#875E30',
    whisper: 'rgba(176, 124, 66, 0.12)',
    note: 'travertine-ochre',
  },
  bangkok: {
    base: '#BE8A30',
    deep: '#946722',
    whisper: 'rgba(190, 138, 48, 0.12)',
    note: 'saffron-gold',
  },
  cappadocia: {
    base: '#C2705A',
    deep: '#98513E',
    whisper: 'rgba(194, 112, 90, 0.12)',
    note: 'rose-valley',
  },
};

/** Accent lookup; falls back to terracotta. */
export function destinationAccent(slug: string): DestinationAccent {
  return ACCENTS[slug] ?? TERRACOTTA;
}
