/**
 * AE294 — pure smart-truncation of trip titles for chips / lists.
 *
 * For the /me/journeys row chip + activity-timeline entries, the
 * full title is often too long. This helper:
 *   - trims
 *   - if length <= max, returns unchanged
 *   - else truncates at a word boundary near max (no mid-word cuts)
 *     and appends "…"
 *
 * Defaults: max=28 chars (about 4 words), respects multi-byte chars
 * via Array.from for unicode safety.
 */

export const SHORT_TITLE_DEFAULT = 28;

export interface ShortTripTitleOptions {
  readonly max?: number;
}

export function shortTripTitle(input: string, opts: ShortTripTitleOptions = {}): string {
  const trimmed = input.trim();
  if (trimmed === '') return '';
  const max = opts.max ?? SHORT_TITLE_DEFAULT;
  const chars = Array.from(trimmed);
  if (chars.length <= max) return trimmed;
  // Find the last space at-or-before max.
  let cut = -1;
  for (let i = Math.min(max - 1, chars.length - 1); i >= 0; i--) {
    if (chars[i] === ' ') {
      cut = i;
      break;
    }
  }
  // Fallback: hard cut at max-1 if no space found.
  if (cut <= 0) cut = max - 1;
  return `${chars.slice(0, cut).join('').trimEnd()}…`;
}
