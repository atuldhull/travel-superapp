/**
 * AE246 — pure destination lookup by slug.
 *
 * Mirrors AE244 selectPinBySlug for the destinations catalogue.
 * Used by the SSG page resolver, Atlas tooltip-to-page bridge,
 * compare permalink, and the 'related places' chip on journal
 * articles (AE99).
 */

export interface SluggedDestination {
  readonly slug: string;
}

export function destinationBySlug<D extends SluggedDestination>(
  destinations: ReadonlyArray<D>,
  slug: string,
): D | null {
  const target = slug.trim();
  if (target === '') return null;
  for (const d of destinations) {
    if (d.slug === target) return d;
  }
  return null;
}

/** Like destinationBySlug but case-insensitive — useful for free-
 *  text journey title matching (AE107 / AE183 trySeasonMatch). */
export function destinationBySlugCi<D extends SluggedDestination>(
  destinations: ReadonlyArray<D>,
  slug: string,
): D | null {
  const target = slug.trim().toLowerCase();
  if (target === '') return null;
  for (const d of destinations) {
    if (d.slug.toLowerCase() === target) return d;
  }
  return null;
}
