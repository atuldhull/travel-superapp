/**
 * AE191 — pure decision helper for the AE155 Esc-in-filter behaviour.
 *
 * Two outcomes:
 *   • `'clear'` — clear the current filter query
 *   • `'focus-row-0'` — move focus to the first row of the listbox
 *   • `null` — the key wasn't Esc (no-op)
 *
 * The rule: Esc on a non-empty filter clears the query; Esc on an
 * already-empty filter hops focus to row 0.
 */

export type EscBehaviour = 'clear' | 'focus-row-0' | null;

export function decideFilterEsc(key: string, queryHasText: boolean): EscBehaviour {
  if (key !== 'Escape') return null;
  return queryHasText ? 'clear' : 'focus-row-0';
}
