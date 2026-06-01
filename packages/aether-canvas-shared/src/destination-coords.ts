/**
 * Destination coordinates — pure data + lookup (AE457).
 *
 * Moved from `apps/web/src/components/aether/phase1/destination-coords.ts`
 * into the Phase 4 shared sub-package so web + native both call the
 * real-weather (Open-Meteo on web, future native weather hook) with the
 * exact same lat/lng for each destination slug.
 *
 * AE395 — curated lat/lng for the destinations Phase 1 already palette-tints.
 * The slug aliases match AE384 `destination-palettes.ts` so a "Five days
 * in Ladakh" trip still resolves to Leh's coords.
 *
 * Coordinates are city centroids (approx). They're stable enough for
 * weather lookups; future slices can refine by reading the trip's
 * primary `placeId.coordinates` directly once Atlas wires that path.
 */

export interface DestinationCoords {
  readonly lat: number;
  readonly lng: number;
}

const lehCoords: DestinationCoords = { lat: 34.1526, lng: 77.5771 };
const goaCoords: DestinationCoords = { lat: 15.2993, lng: 74.124 };
const keralaCoords: DestinationCoords = { lat: 9.4981, lng: 76.3388 }; // Alleppey
const jaipurCoords: DestinationCoords = { lat: 26.9124, lng: 75.7873 };
const varanasiCoords: DestinationCoords = { lat: 25.3176, lng: 82.9739 };
const darjeelingCoords: DestinationCoords = { lat: 27.041, lng: 88.2663 };
const coorgCoords: DestinationCoords = { lat: 12.3375, lng: 75.8069 };
const hampiCoords: DestinationCoords = { lat: 15.335, lng: 76.46 };

/** Canonical slug → coords map. Aliases share object identity so a
 *  `paletteForDestination(slug)`-style lookup runs in O(1). */
const COORDS: Readonly<Record<string, DestinationCoords>> = Object.freeze({
  leh: lehCoords,
  ladakh: lehCoords,
  spiti: lehCoords,
  goa: goaCoords,
  anjuna: goaCoords,
  andaman: goaCoords,
  kerala: keralaCoords,
  alleppey: keralaCoords,
  rajasthan: jaipurCoords,
  jaipur: jaipurCoords,
  varanasi: varanasiCoords,
  darjeeling: darjeelingCoords,
  coorg: coorgCoords,
  hampi: hampiCoords,
});

/** Look up coords for a destination slug. Case-insensitive. Returns
 *  null when the slug isn't curated (so the caller can fall back to
 *  AE388 simulation). */
export function coordsForDestination(slug: string | null | undefined): DestinationCoords | null {
  if (slug === null || slug === undefined || slug === '') return null;
  const lower = slug.toLowerCase();
  // eslint-disable-next-line security/detect-object-injection -- lower
  // is normalised lowercased input, the lookup table is frozen and
  // bounded to a fixed set of slugs (no prototype pollution risk).
  const hit = COORDS[lower];
  return hit ?? null;
}

/** Convenience — slugs Phase 1 has coords for. Sorted for determinism. */
export function curatedCoordSlugs(): ReadonlyArray<string> {
  return Object.keys(COORDS).sort();
}
