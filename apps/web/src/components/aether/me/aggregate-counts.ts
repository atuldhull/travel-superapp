/**
 * AE259 — pure aggregate-counts derivation for the /me/aggregate
 * dashboard surface (AE49).
 *
 * Today /me shows tiles like "3 active · 2 archived · 1 upcoming".
 * The 4 numbers are computed inline. This helper canonicalises:
 *
 *   aggregateMeCounts(trips, now?)
 *     → { totalTrips, active, upcoming, past, archived, draft, liveShares }
 *
 * Uses AE217 deriveTripStatus + AE250 computeShareListStats so
 * the dashboard agrees with the per-row + per-share surfaces.
 */
import { deriveTripStatus } from '../journey/derive-trip-status';
import { computeShareListStats, type ShareLike } from '../journey/share-list-stats';

export interface AggregateTripInputs {
  readonly startsOn: string | null;
  readonly endsOn: string | null;
  readonly archivedAt: string | null;
  readonly shares?: ReadonlyArray<ShareLike>;
}

export interface AggregateMeCounts {
  readonly totalTrips: number;
  readonly active: number;
  readonly upcoming: number;
  readonly past: number;
  readonly archived: number;
  readonly draft: number;
  readonly liveShares: number;
}

export function aggregateMeCounts(
  trips: ReadonlyArray<AggregateTripInputs>,
  now: Date = new Date(),
): AggregateMeCounts {
  const out = {
    totalTrips: trips.length,
    active: 0,
    upcoming: 0,
    past: 0,
    archived: 0,
    draft: 0,
    liveShares: 0,
  };
  for (const t of trips) {
    out[deriveTripStatus(t, now)] += 1;
    if (t.shares !== undefined) {
      out.liveShares += computeShareListStats(t.shares).live;
    }
  }
  return out;
}
