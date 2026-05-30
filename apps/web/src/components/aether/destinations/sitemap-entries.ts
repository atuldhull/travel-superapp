/**
 * AE270 — pure sitemap-entry generator for the destinations
 * section.
 *
 * AE53 generates `/aether/sitemap.xml` from a list of routes. As
 * the destination + journal catalogues grow, the sitemap should
 * stay in sync without each addition risking a forgotten entry.
 * This helper canonicalises:
 *
 *   destinationSitemapEntries(destinations, origin)
 *     → [{ url: '<origin>/aether/destinations/<slug>', lastmod, priority }]
 *
 * `lastmod` uses the destination's updatedAt if present, otherwise
 * a stable site-wide constant the caller passes in (the build SHA's
 * date, typically).
 *
 * Sort: alphabetical by slug (deterministic across runs).
 */

import { destinationAbsoluteHref } from './destination-href';

export interface SitemapDestination {
  readonly slug: string;
  readonly updatedAt?: string | null;
}

export interface SitemapEntry {
  readonly url: string;
  readonly lastmod: string;
  readonly priority: number;
}

export interface SitemapBuilderOptions {
  readonly origin: string;
  readonly fallbackLastmod: string;
  readonly priority?: number;
}

export function destinationSitemapEntries(
  destinations: ReadonlyArray<SitemapDestination>,
  opts: SitemapBuilderOptions,
): SitemapEntry[] {
  const sorted = [...destinations].sort((a, b) => a.slug.localeCompare(b.slug));
  return sorted
    .filter((d) => d.slug.trim() !== '')
    .map((d) => ({
      url: destinationAbsoluteHref(d.slug, opts.origin),
      lastmod:
        d.updatedAt !== null && d.updatedAt !== undefined && d.updatedAt !== ''
          ? d.updatedAt
          : opts.fallbackLastmod,
      priority: opts.priority ?? 0.7,
    }));
}
