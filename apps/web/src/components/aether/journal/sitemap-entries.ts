/**
 * AE271 — pure sitemap-entry generator for the journal section.
 *
 * Mirrors AE270 destinationSitemapEntries. Distinct because journal
 * entries get a different default priority (0.6) and use publishedOn
 * as the lastmod source.
 */

import { articleAbsoluteHref } from './article-href';

export interface SitemapArticle {
  readonly slug: string;
  readonly publishedOn?: string | null;
  readonly updatedAt?: string | null;
}

export interface SitemapEntry {
  readonly url: string;
  readonly lastmod: string;
  readonly priority: number;
}

export interface JournalSitemapOptions {
  readonly origin: string;
  readonly fallbackLastmod: string;
  readonly priority?: number;
}

export function journalSitemapEntries(
  articles: ReadonlyArray<SitemapArticle>,
  opts: JournalSitemapOptions,
): SitemapEntry[] {
  // Sort: newest first by publishedOn, alphabetical tiebreak.
  const sorted = [...articles].sort((a, b) => {
    const ta = new Date(a.publishedOn ?? '').getTime();
    const tb = new Date(b.publishedOn ?? '').getTime();
    const dt = (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
    if (dt !== 0) return dt;
    return a.slug.localeCompare(b.slug);
  });
  return sorted
    .filter((a) => a.slug.trim() !== '')
    .map((a) => ({
      url: articleAbsoluteHref(a.slug, opts.origin),
      lastmod:
        a.updatedAt !== null && a.updatedAt !== undefined && a.updatedAt !== ''
          ? a.updatedAt
          : a.publishedOn !== null && a.publishedOn !== undefined && a.publishedOn !== ''
            ? a.publishedOn
            : opts.fallbackLastmod,
      priority: opts.priority ?? 0.6,
    }));
}
