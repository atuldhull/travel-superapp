/**
 * AE210 — pure pin-filter combinator for Atlas.
 *
 * The AE69 substring filter + AE86 'in season only' toggle were
 * coupled inside a useMemo inline lambda. This helper lifts the
 * combinator so the AND-of-predicates behaviour can be unit-tested
 * without mounting the Leaflet canvas or AE83 month tables.
 *
 * Predicates (must match atlas-canvas):
 *   - text query: case-insensitive substring across name/state/tagline
 *   - season toggle: when true, drop pins whose slug is NOT in season
 *
 * The season check is injected (isInSeason) so tests don't have to
 * use the real month table — they pass a fixture predicate.
 */

export interface FilterablePin {
  readonly slug: string;
  readonly name: string;
  readonly state: string;
  readonly tagline: string;
}

export interface FilterPinsOptions {
  readonly query: string;
  readonly seasonOnly: boolean;
  readonly isInSeason: (slug: string) => boolean;
}

export function filterPins<P extends FilterablePin>(
  pins: ReadonlyArray<P>,
  opts: FilterPinsOptions,
): P[] {
  const q = opts.query.trim().toLowerCase();
  return pins.filter((p) => {
    if (q !== '') {
      const hits =
        p.name.toLowerCase().includes(q) ||
        p.state.toLowerCase().includes(q) ||
        p.tagline.toLowerCase().includes(q);
      if (!hits) return false;
    }
    if (opts.seasonOnly === true && opts.isInSeason(p.slug) === false) return false;
    return true;
  });
}
