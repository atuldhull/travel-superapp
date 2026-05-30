/**
 * AE192 — pure helpers for the AE159 Pulse pending phrase rotation.
 *
 * 3 phrases drive a "Reading… → Sketching the route… → Almost there…"
 * cascade while a chat reply is pending. The pulse drawer holds the
 * index in state + advances it on a 1.5s interval; we extract the
 * catalogue + the bump rule so a future change (rate, phrasing, RTL
 * locale) lives in one file with specs around it.
 */

export const PENDING_PHRASES: ReadonlyArray<string> = [
  'Reading…',
  'Sketching the route…',
  'Almost there…',
];

/** Advance to the next index, clamped at the last so a long wait
 *  reads as "Almost there…" rather than looping back to "Reading…". */
export function nextPendingIdx(current: number): number {
  if (current < 0) return 0;
  const last = PENDING_PHRASES.length - 1;
  return current < last ? current + 1 : last;
}

/** Resolve an index to a phrase. Out-of-range falls back to phrase 0
 *  so a stale index from a previous render never shows nothing. */
export function phraseAt(idx: number): string {
  if (idx < 0 || idx >= PENDING_PHRASES.length) return PENDING_PHRASES[0]!;
  return PENDING_PHRASES[idx]!;
}
