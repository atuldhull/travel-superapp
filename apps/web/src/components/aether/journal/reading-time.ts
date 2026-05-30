/**
 * AE209 — words-per-minute reading-time estimator.
 *
 * The journal pre-bakes `readMins` per article, but several future
 * surfaces want a derivable estimate (Pulse plan summaries, RSS feed
 * "X min", auto-imported notes). This helper takes either a string or
 * the journal's body-block shape and returns minutes rounded UP — a
 * conservative read time feels honest; the alternative is "1 min" on
 * dense paragraphs that take three.
 *
 * Default 220 wpm matches Medium / Pocket / most "min read" badges —
 * lower would over-estimate; higher would feel optimistic to slow
 * readers.
 *
 * Whitespace is split on /\s+/ so multi-space, tabs, newlines all
 * collapse to a single word boundary. An empty / whitespace-only
 * input yields 0 minutes (NOT 1) so an empty article doesn't show
 * "1 min read".
 */

export const DEFAULT_READING_WPM = 220;

export interface ReadingBlock {
  readonly text: string;
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed === '') return 0;
  return trimmed.split(/\s+/).length;
}

export function estimateReadingMinutes(
  input: string | ReadonlyArray<ReadingBlock>,
  wpm: number = DEFAULT_READING_WPM,
): number {
  const totalWords =
    typeof input === 'string'
      ? countWords(input)
      : input.reduce((sum, b) => sum + countWords(b.text), 0);
  if (totalWords === 0) return 0;
  if (wpm <= 0) return 0;
  return Math.max(1, Math.ceil(totalWords / wpm));
}
