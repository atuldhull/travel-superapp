/**
 * AE216 — visibility gate for the AE132 'Try one of these' seed
 * prompt strip.
 *
 * The rule is intentionally simple — show the curated trio iff
 * Recent has fewer than 3 entries — but the threshold is now in
 * one place so a future "show on cold-start, hide after first
 * send" rule lands without scanning pulse.tsx for the magic 3.
 *
 * Pure boolean, no side effects.
 */

/** Threshold at which Recent crowds out the seeded suggestions. */
export const SUGGESTIONS_RECENT_THRESHOLD = 3;

export interface ShouldShowSuggestionsInputs {
  readonly recentCount: number;
}

export function shouldShowSuggestions(inputs: ShouldShowSuggestionsInputs): boolean {
  return inputs.recentCount < SUGGESTIONS_RECENT_THRESHOLD;
}
