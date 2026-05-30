/**
 * Find destinations related to a journal article (AE99, inverse of
 * AE88). The match is: a destination's city or state name appears
 * in the article's kicker / title / dek.
 *
 * Phase 0 stays on substring matching to avoid an explicit
 * destinations-tag column on JournalArticle. Phase 2 swaps to a
 * tag-array per article.
 */
import { ALL_SLUGS, DESTINATIONS, type Destination } from '../destinations/data';
import type { JournalArticle } from './data';

export function relatedDestinations(a: JournalArticle): Destination[] {
  const haystack = `${a.kicker} ${a.title} ${a.dek}`.toLowerCase();
  const out: Destination[] = [];
  for (const slug of ALL_SLUGS) {
    const d = DESTINATIONS[slug];
    if (d === undefined) continue;
    const city = d.name.toLowerCase();
    const state = d.state.toLowerCase();
    if (haystack.includes(city) || haystack.includes(state)) {
      out.push(d);
    }
  }
  return out;
}
