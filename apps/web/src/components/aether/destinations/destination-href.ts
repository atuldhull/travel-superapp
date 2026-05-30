/**
 * AE242 — pure URL builders for Aether destination pages.
 *
 * Mirrors AE241 articleHref but for /aether/destinations/<slug>.
 * Used by the destinations index, journey-row 'related place' chip
 * (AE107), Atlas tooltip CTA, and the AE73 compare permalink.
 */

const DEST_BASE = '/aether/destinations';

function trimTrailingSlash(s: string): string {
  return s.endsWith('/') ? s.slice(0, -1) : s;
}

export function destinationHref(slug: string): string {
  const s = slug.trim();
  if (s === '') return '';
  return `${DEST_BASE}/${encodeURIComponent(s)}`;
}

export function destinationAbsoluteHref(slug: string, origin: string): string {
  const path = destinationHref(slug);
  if (path === '') return '';
  return `${trimTrailingSlash(origin)}${path}`;
}

/** AE73 — compare permalink (?a=&b=). Both slugs required; either
 *  empty returns '' so the caller can hide / disable the link. */
export function compareHref(a: string, b: string): string {
  const ta = a.trim();
  const tb = b.trim();
  if (ta === '' || tb === '') return '';
  return `${DEST_BASE}/compare?a=${encodeURIComponent(ta)}&b=${encodeURIComponent(tb)}`;
}
