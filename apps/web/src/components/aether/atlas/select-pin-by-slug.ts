/**
 * AE244 — pure pin lookup by slug.
 *
 * Used by Atlas tooltip routing, keyboard nav (Enter on a row →
 * focus pin), and the future ?focus=<slug> permalink. The math is
 * find-by-key but the canonical form needs a single place so an
 * out-of-band rename doesn't drift across surfaces.
 *
 * Returns `null` for misses (not undefined) so callers can use a
 * concise `if (pin === null)` guard.
 */

export interface SluggedPin {
  readonly slug: string;
}

export function selectPinBySlug<P extends SluggedPin>(
  pins: ReadonlyArray<P>,
  slug: string,
): P | null {
  const target = slug.trim();
  if (target === '') return null;
  for (const p of pins) {
    if (p.slug === target) return p;
  }
  return null;
}

/** Returns the index of the pin, -1 if missing. Convenient for
 *  rovingtab keyboard nav (AE117). */
export function indexOfPinBySlug<P extends SluggedPin>(
  pins: ReadonlyArray<P>,
  slug: string,
): number {
  const target = slug.trim();
  if (target === '') return -1;
  for (let i = 0; i < pins.length; i++) {
    if (pins[i]?.slug === target) return i;
  }
  return -1;
}
