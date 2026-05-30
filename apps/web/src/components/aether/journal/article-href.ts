/**
 * AE241 — pure URL builder for journal articles.
 *
 * The journal index, sitemap, RSS feed, and "related articles"
 * widget each build `/aether/journal/<slug>` from a `slug`. This
 * helper canonicalises:
 *
 *   articleHref(slug) → '/aether/journal/<slug>'
 *   articleAbsoluteHref(slug, origin) → '<origin>/aether/journal/<slug>'
 *
 * Empty / whitespace-only slug returns '' so callers can render
 * "—" or skip without throwing.
 */

const JOURNAL_BASE = '/aether/journal';

function trimTrailingSlash(s: string): string {
  return s.endsWith('/') ? s.slice(0, -1) : s;
}

export function articleHref(slug: string): string {
  const s = slug.trim();
  if (s === '') return '';
  return `${JOURNAL_BASE}/${encodeURIComponent(s)}`;
}

export function articleAbsoluteHref(slug: string, origin: string): string {
  const path = articleHref(slug);
  if (path === '') return '';
  return `${trimTrailingSlash(origin)}${path}`;
}
