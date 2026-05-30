/**
 * AE249 — pure article lookup by slug.
 *
 * Mirrors AE246 destinationBySlug for the journal. Used by the
 * SSG page resolver, the RSS feed builder, the AE99 'visit
 * destinations' cross-link panel, and the `relatedArticles(d)`
 * helper.
 */

export interface SluggedArticle {
  readonly slug: string;
}

export function articleBySlug<A extends SluggedArticle>(
  articles: ReadonlyArray<A>,
  slug: string,
): A | null {
  const target = slug.trim();
  if (target === '') return null;
  for (const a of articles) {
    if (a.slug === target) return a;
  }
  return null;
}

export function indexOfArticleBySlug<A extends SluggedArticle>(
  articles: ReadonlyArray<A>,
  slug: string,
): number {
  const target = slug.trim();
  if (target === '') return -1;
  for (let i = 0; i < articles.length; i++) {
    if (articles[i]?.slug === target) return i;
  }
  return -1;
}
