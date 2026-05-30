/**
 * AE240 — minimal URLSearchParams helpers for Aether routes that
 * build links with optional filter state.
 *
 * AE73 destinations/compare uses ?a=&b= for the twin slugs;
 * AE45 addPlace banner reads ?addPlace=;
 * future Atlas permalink will use ?q=&season=.
 *
 * Helper canonicalises:
 *   - omit keys with null / undefined / '' values
 *   - sort keys deterministically (so two surfaces building the
 *     same query produce the same string — easier to cache + test)
 *   - return only the query (no leading '?') so callers can decide
 *     whether to prepend
 */

export function buildQueryString(
  params: Record<string, string | number | null | undefined>,
): string {
  const keys = Object.keys(params).sort();
  const out: string[] = [];
  for (const k of keys) {
    const v = params[k];
    if (v === null || v === undefined) continue;
    const s = typeof v === 'number' ? String(v) : v;
    if (s === '') continue;
    out.push(`${encodeURIComponent(k)}=${encodeURIComponent(s)}`);
  }
  return out.join('&');
}

/** Append `params` as the query string of `path`. If `path` already
 *  has a '?', appends with '&' instead. Empty params return path
 *  unchanged. */
export function appendQuery(
  path: string,
  params: Record<string, string | number | null | undefined>,
): string {
  const qs = buildQueryString(params);
  if (qs === '') return path;
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}${qs}`;
}
