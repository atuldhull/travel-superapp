/**
 * AE237 — partition trips by AE217 lifecycle status.
 *
 * The /me/journeys page renders three buckets: Active (incl.
 * upcoming + active + past not-archived) and Archived, with
 * Draft sometimes folded into Active. This helper canonicalises:
 *
 *   groupTripsByStatus(trips, now?)
 *     → { active, upcoming, past, archived, draft }
 *
 * Each bucket preserves the input order. Pure — uses AE217
 * deriveTripStatus internally.
 */
import { deriveTripStatus, type TripStatus } from '../journey/derive-trip-status';

export interface TripBucketInputs {
  readonly startsOn: string | null;
  readonly endsOn: string | null;
  readonly archivedAt: string | null;
}

export interface TripStatusBuckets<T> {
  readonly active: T[];
  readonly upcoming: T[];
  readonly past: T[];
  readonly archived: T[];
  readonly draft: T[];
}

export function groupTripsByStatus<T extends TripBucketInputs>(
  trips: ReadonlyArray<T>,
  now: Date = new Date(),
): TripStatusBuckets<T> {
  const out: TripStatusBuckets<T> = {
    active: [],
    upcoming: [],
    past: [],
    archived: [],
    draft: [],
  };
  for (const t of trips) {
    const status: TripStatus = deriveTripStatus(t, now);
    out[status].push(t);
  }
  return out;
}
