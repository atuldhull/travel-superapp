/**
 * AE173 — pure helper extracted from journal-index.tsx (AE74).
 *
 * Slice the canonical tag stem from a kicker string like
 * "Field notes · Old Delhi" → "Field notes". Multi-word stems are
 * preserved; single-word kickers map to themselves; the helper trims
 * extraneous whitespace and tolerates the absence of a "·" separator.
 */
export function tagOf(kicker: string): string {
  const idx = kicker.indexOf('·');
  return (idx === -1 ? kicker : kicker.slice(0, idx)).trim();
}
