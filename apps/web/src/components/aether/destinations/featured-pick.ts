/**
 * AE263 — pure "destination of the day" picker.
 *
 * The destinations index could rotate a featured hero card every
 * day so a returning user sees variety. This helper picks one
 * deterministic destination from the catalogue, varying by date.
 *
 * Rule (priority order):
 *   1. an in-season destination if any are in season today
 *   2. otherwise just rotate through all destinations
 *
 * Uses the day-of-year as the seed so the pick is stable for a
 * day and rotates exactly once at midnight. Same date + same
 * catalogue → same pick.
 *
 * Returns null only for an empty catalogue.
 */

export interface FeaturedCandidate {
  readonly slug: string;
}

export interface FeaturedPickOptions {
  readonly isInSeason: (slug: string) => boolean;
}

// AE341 — shared dayOfYear helper (was inlined here before extraction).
import { dayOfYear } from '../../../lib/day-of-year';

export function pickFeaturedDestination<D extends FeaturedCandidate>(
  destinations: ReadonlyArray<D>,
  now: Date,
  opts: FeaturedPickOptions,
): D | null {
  if (destinations.length === 0) return null;
  const inSeason = destinations.filter((d) => opts.isInSeason(d.slug));
  const pool = inSeason.length > 0 ? inSeason : destinations;
  const idx = dayOfYear(now) % pool.length;
  return pool[idx] ?? null;
}
