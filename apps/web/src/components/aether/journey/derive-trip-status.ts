/**
 * AE217 — pure derivation of a trip's lifecycle status from its dates.
 *
 * Used by /me/journeys + /shared/[code] + journey-dashboard to surface
 * a single status chip. Today these surfaces each compute their own
 * variation; this helper consolidates the rule so they agree.
 *
 * Rule (in priority order):
 *   1. archivedAt set         → 'archived'
 *   2. both dates missing     → 'draft'
 *   3. now < startsOn         → 'upcoming'
 *   4. endsOn < now           → 'past'
 *   5. otherwise              → 'active'
 *
 * Comparison uses local-date midpoint timestamps; passing an
 * explicit `now` keeps the helper deterministic in tests.
 */

export type TripStatus = 'draft' | 'upcoming' | 'active' | 'past' | 'archived';

export interface TripStatusInputs {
  readonly startsOn: string | null;
  readonly endsOn: string | null;
  readonly archivedAt: string | null;
}

function tsOf(iso: string | null): number | null {
  if (iso === null) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
}

export function deriveTripStatus(inputs: TripStatusInputs, now: Date = new Date()): TripStatus {
  if (inputs.archivedAt !== null && inputs.archivedAt !== '') return 'archived';
  const starts = tsOf(inputs.startsOn);
  const ends = tsOf(inputs.endsOn);
  if (starts === null && ends === null) return 'draft';
  const t = now.getTime();
  if (starts !== null && t < starts) return 'upcoming';
  if (ends !== null && ends < t) return 'past';
  return 'active';
}
