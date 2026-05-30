/**
 * AE226 — pure progress derivation for the AE94 TripChecklist.
 *
 * The dashboard wants a "5 of 12 packed" kicker over the checklist
 * card, plus a 0-1 fraction for the pill / progress-bar render.
 * Today the count is computed inline (filter then length). This
 * helper canonicalises:
 *
 *   - total: items.length
 *   - done: items where checked === true
 *   - fraction: done / total (0 when empty)
 *   - percent: rounded fraction × 100 (so the badge says '42%' not '41.66%')
 *   - allDone: done === total when total > 0
 *
 * Empty list returns { total:0, done:0, fraction:0, percent:0, allDone:false }
 * so the kicker can render '0 items' without divide-by-zero.
 */

export interface ChecklistProgressItem {
  readonly checked: boolean;
}

export interface ChecklistProgress {
  readonly total: number;
  readonly done: number;
  readonly fraction: number;
  readonly percent: number;
  readonly allDone: boolean;
}

export function computeChecklistProgress(
  items: ReadonlyArray<ChecklistProgressItem>,
): ChecklistProgress {
  const total = items.length;
  const done = items.filter((i) => i.checked === true).length;
  const fraction = total === 0 ? 0 : done / total;
  const percent = Math.round(fraction * 100);
  const allDone = total > 0 && done === total;
  return { total, done, fraction, percent, allDone };
}
