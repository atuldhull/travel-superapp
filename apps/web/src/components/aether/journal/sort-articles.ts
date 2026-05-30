/**
 * AE236 — pure sort for the journal index list.
 *
 * Today the journal index renders `JOURNAL_ARTICLES` in source
 * order. As the catalogue grows, surfaces will want "newest
 * first" plus a stable tiebreak so two articles with the same
 * publishedOn render in a deterministic order. This helper
 * canonicalises:
 *
 *   newest publishedOn first
 *   tie → original index ascending (stable)
 *
 * `publishedOn` strings that fail to parse sort to the end
 * (treated as "unknown date"). Returns a NEW array; input not mutated.
 */

export interface JournalArticleSortable {
  readonly slug: string;
  readonly publishedOn: string;
}

function tsOf(s: string): number {
  const t = new Date(s).getTime();
  return Number.isFinite(t) ? t : Number.NEGATIVE_INFINITY;
}

export function sortArticlesNewestFirst<A extends JournalArticleSortable>(
  articles: ReadonlyArray<A>,
): A[] {
  return articles
    .map((a, idx) => ({ a, idx }))
    .sort((x, y) => {
      const dt = tsOf(y.a.publishedOn) - tsOf(x.a.publishedOn);
      if (dt !== 0) return dt;
      return x.idx - y.idx;
    })
    .map(({ a }) => a);
}
