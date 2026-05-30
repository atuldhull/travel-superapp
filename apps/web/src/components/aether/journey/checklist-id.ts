/**
 * AE201 — pure id-builder for AE94 user-created checklist items.
 *
 * Shape: `u-<base36 timestamp>-<base36 4-digit random>`. The `u-`
 * prefix distinguishes user-added items from the starter pack ids
 * (`k1` … `kN`, `p-<slug>-<n>`). The base36 timestamp keeps the ids
 * short while still being naturally time-sortable for debugging.
 *
 * The `now` + `rand` parameters are injectable so tests can pin both
 * sources of entropy and assert the exact output.
 */

export function makeChecklistItemId(
  now: number = Date.now(),
  rand: number = Math.random(),
): string {
  const ts = Math.floor(now).toString(36);
  const r = Math.floor(rand * 1e4).toString(36);
  return `u-${ts}-${r}`;
}
