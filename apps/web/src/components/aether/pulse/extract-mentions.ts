/**
 * AE304 — pure @destination-mention extractor from a Pulse prompt.
 *
 * Future: typing '@leh' surfaces an autocomplete bubble; the
 * mention is replaced with the canonical destination name on
 * submit. This helper extracts the lowercased slugs from a raw
 * prompt:
 *
 *   "Plan @leh + @alleppey for me" → ['leh', 'alleppey']
 *
 * Rules:
 *   - case-insensitive (output lowercased)
 *   - de-duped (first occurrence wins on order)
 *   - matches [a-z0-9_-]+ after '@'
 *   - empty input → []
 */

const MENTION_RE = /@([a-z0-9_-]+)/gi;

export function extractMentions(input: string): string[] {
  if (input === '') return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const match of input.matchAll(MENTION_RE)) {
    const slug = (match[1] ?? '').toLowerCase();
    if (slug === '' || seen.has(slug)) continue;
    seen.add(slug);
    out.push(slug);
  }
  return out;
}
