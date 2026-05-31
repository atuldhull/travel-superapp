/**
 * AE296 — pure modular-arithmetic wrap helper for Atlas keyboard
 * cursor (AE111 listbox nav).
 *
 * Today atlas-canvas computes the wrapped row index inline:
 *   const wrapped = ((idx % total) + total) % total;
 *
 * Pulled out so the modulo dance + the empty-list guard live in
 * one tested place. Returns -1 when total === 0 so the caller can
 * use it as a sentinel for "no rows to focus".
 */

export function wrapRowIndex(idx: number, total: number): number {
  if (total <= 0) return -1;
  // JS % preserves sign of the dividend; add `total` to lift any
  // negative remainder into the positive range, then mod again.
  const wrapped = ((idx % total) + total) % total;
  return wrapped;
}
