/**
 * AE243 — pure formatter for the planner's text payload before it
 * lands in the Pulse bubble.
 *
 * The /trips/sample-plan endpoint occasionally returns plans with
 * leading blank lines (a markdown idiom), trailing whitespace, or
 * an unwanted "Plan:" / "Itinerary:" prefix that the planner left
 * in as a header. This helper canonicalises a calm output:
 *
 *   - trim trailing whitespace
 *   - collapse 3+ consecutive blank lines to 2
 *   - drop the leading "Plan:" / "Itinerary:" / "Trip:" line if it
 *     is the first non-empty line and on its own
 *   - preserve internal markdown formatting (asterisks, dashes,
 *     headings, etc.)
 *
 * Empty / whitespace-only input returns ''.
 */

const LEADING_HEADERS = ['plan:', 'itinerary:', 'trip:'];

function dropLeadingHeader(text: string): string {
  const idx = text.indexOf('\n');
  const first = (idx === -1 ? text : text.slice(0, idx)).trim();
  if (LEADING_HEADERS.includes(first.toLowerCase()) === false) return text;
  return idx === -1 ? '' : text.slice(idx + 1).replace(/^\s+/, '');
}

export function formatPlanText(raw: string): string {
  if (raw.trim() === '') return '';
  let text = raw.replace(/\s+$/, '');
  text = dropLeadingHeader(text);
  text = text.replace(/\n{3,}/g, '\n\n');
  return text;
}
