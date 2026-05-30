/**
 * AE251 — pure router for the Atlas "no pins to show" copy.
 *
 * Today Atlas hardcodes "No places match." When the filter
 * combinator (AE210) is engaged with both text + season, the copy
 * should hint at which to relax — "Nothing in season matches 'leh'.
 * Try clearing one." This helper canonicalises the routing:
 *
 *   neither active  → 'No places yet.'         (effectively unreachable)
 *   text only       → 'No places match "<q>".'
 *   season only     → 'Nothing in season this month.'
 *   text + season   → 'Nothing in season matches "<q>". Try clearing one.'
 */

export interface AtlasEmptyStateInputs {
  readonly query: string;
  readonly seasonOnly: boolean;
}

export function atlasEmptyStateCopy(inputs: AtlasEmptyStateInputs): string {
  const q = inputs.query.trim();
  const hasQuery = q !== '';
  const hasSeason = inputs.seasonOnly === true;
  if (hasQuery && hasSeason) return `Nothing in season matches "${q}". Try clearing one.`;
  if (hasQuery) return `No places match "${q}".`;
  if (hasSeason) return 'Nothing in season this month.';
  return 'No places yet.';
}
