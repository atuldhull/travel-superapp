/**
 * AE287 — pure state-bucket grouping for destinations.
 *
 * The destinations index could surface a "by state" view (Ladakh ·
 * Rajasthan · Kerala). This helper canonicalises the bucketing:
 *
 *   - state name lookup case-sensitive
 *   - empty / missing state → 'Other' bucket
 *   - within each bucket, original order preserved
 *   - state-name keys sorted alphabetically in the returned map
 *     keys (deterministic across runs)
 */

export interface StatedDestination {
  readonly slug: string;
  readonly state?: string | null;
}

export function groupByState<D extends StatedDestination>(
  destinations: ReadonlyArray<D>,
): Map<string, D[]> {
  const buckets = new Map<string, D[]>();
  for (const d of destinations) {
    const raw = (d.state ?? '').trim();
    const key = raw === '' ? 'Other' : raw;
    let bucket = buckets.get(key);
    if (bucket === undefined) {
      bucket = [];
      buckets.set(key, bucket);
    }
    bucket.push(d);
  }
  // Re-emit in alpha order; Map insertion order matters for callers.
  const sortedKeys = [...buckets.keys()].sort((a, b) => a.localeCompare(b));
  const out = new Map<string, D[]>();
  for (const k of sortedKeys) {
    const v = buckets.get(k);
    if (v !== undefined) out.set(k, v);
  }
  return out;
}
