/**
 * AE183 — pure helper extracted from journeys-index.tsx (AE107).
 *
 * Tag a trip with the first known destination that:
 *   1. The trip title mentions (case-insensitive substring of the
 *      destination's display name), AND
 *   2. Is currently in season (per AE83 seasons.ts).
 *
 * Returns `{ slug, name }` for the linkable chip — or `null`.
 *
 * The `now` parameter is forwarded to `isInSeason` so the helper is
 * deterministic in tests; production calls pass the current Date.
 */
import { DESTINATIONS, ALL_SLUGS } from '../destinations/data';
import { isInSeason } from '../destinations/seasons';

export function trySeasonMatch(
  title: string,
  now: Date = new Date(),
): { slug: string; name: string } | null {
  const hay = title.toLowerCase();
  for (const slug of ALL_SLUGS) {
    const d = DESTINATIONS[slug];
    if (d === undefined) continue;
    if (hay.includes(d.name.toLowerCase()) && isInSeason(slug, now)) {
      return { slug, name: d.name };
    }
  }
  return null;
}
