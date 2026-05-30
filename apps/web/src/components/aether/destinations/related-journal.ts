/**
 * Find journal articles related to a destination (AE88).
 *
 * Phase 0 heuristic: an article matches a destination when the
 * article's kicker mentions the destination's city or state. Falls
 * back to the city-name appearing in the dek or title.
 *
 * Phase 2 swaps to an explicit tag column on the article model.
 */
import { JOURNAL_ARTICLES, ALL_JOURNAL_SLUGS, type JournalArticle } from '../journal/data';
import type { Destination } from './data';

export function relatedArticles(d: Destination): JournalArticle[] {
  const cityNeedle = d.name.toLowerCase();
  const stateNeedle = d.state.toLowerCase();
  const out: JournalArticle[] = [];
  for (const slug of ALL_JOURNAL_SLUGS) {
    const a = JOURNAL_ARTICLES[slug];
    if (a === undefined) continue;
    const haystack = `${a.kicker} ${a.title} ${a.dek}`.toLowerCase();
    if (haystack.includes(cityNeedle) || haystack.includes(stateNeedle)) {
      out.push(a);
    }
  }
  return out;
}
