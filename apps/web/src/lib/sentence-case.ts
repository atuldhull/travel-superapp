/**
 * AE258 — pure sentence-case formatter.
 *
 * AI planner outputs sometimes return ALL CAPS or Title Case
 * Strings That Capitalise Every Word, which clashes with the
 * editorial typography. This helper lowercases everything except
 * the first letter + recognised proper nouns + acronyms passed in.
 *
 *   sentenceCase("PLAN A TRIP TO LEH")     → 'Plan a trip to leh'
 *   sentenceCase("plan a trip to leh", ['Leh']) → 'Plan a trip to Leh'
 *
 * Pure, no DB. The keep-as-is list is for proper nouns the caller
 * knows about (destination names, brand names, acronyms like RSVP).
 */

export function sentenceCase(input: string, keepAsIs: ReadonlyArray<string> = []): string {
  const trimmed = input.trim();
  if (trimmed === '') return '';
  const lower = trimmed.toLowerCase();
  const capitalised = lower.charAt(0).toUpperCase() + lower.slice(1);
  if (keepAsIs.length === 0) return capitalised;
  let out = capitalised;
  for (const word of keepAsIs) {
    if (word === '') continue;
    const safe = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`\\b${safe}\\b`, 'gi');
    out = out.replace(re, word);
  }
  return out;
}
