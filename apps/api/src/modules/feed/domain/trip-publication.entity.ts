/**
 * POST.2B.2 — TripPublication + the two privacy invariants.
 *
 * Publishing is a SAFETY feature, not a sharing convenience. The
 * invariants live HERE (pure, unit-tested without HTTP/DB):
 *
 *   INVARIANT A — a trip can only be published once it has
 *   DEFINITIVELY ended. A null end date or an end date in the
 *   future is refused (you must not broadcast that your home is
 *   empty while the trip is upcoming/ongoing).
 *
 *   INVARIANT B — the exposed location is coarsened by visibility:
 *   PRIVATE → none; PUBLIC → city-level (~11 km); FOLLOWERS →
 *   precise ONLY if the user explicitly opted in, else coarsened.
 *
 * Installed by prompt [POST.2B.2].
 */
import { ValidationError } from '@app/errors';

export type Visibility = 'PRIVATE' | 'FOLLOWERS' | 'PUBLIC';

export interface TripPublication {
  readonly id: string;
  readonly tripId: string;
  readonly authorId: string;
  readonly memoryBookId: string | null;
  readonly visibility: Visibility;
  readonly exposedLat: number | null;
  readonly exposedLng: number | null;
  readonly publishedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** INVARIANT A — throws 422 unless the trip has definitively ended. */
export function assertPublishable(tripEndsOn: Date | null, now: Date): void {
  if (tripEndsOn === null || tripEndsOn.getTime() >= now.getTime()) {
    throw new ValidationError(
      'A trip can only be published after it has ended',
      { endsOn: ['trip has no end date or has not ended yet'] },
      {},
      'TRIP_NOT_ENDED',
    );
  }
}

/** ~0.1° ≈ 11 km — city-level, never the exact spot. */
export function coarsenCoord(n: number): number {
  return Math.round(n * 10) / 10;
}

/** INVARIANT B — exposed geo per visibility + opt-in. */
export function exposeGeo(
  lat: number | null,
  lng: number | null,
  visibility: Visibility,
  preciseOptIn: boolean,
): { lat: number | null; lng: number | null } {
  if (visibility === 'PRIVATE' || lat === null || lng === null) {
    return { lat: null, lng: null };
  }
  if (visibility === 'FOLLOWERS' && preciseOptIn) {
    return { lat, lng };
  }
  // PUBLIC always coarsens; FOLLOWERS without opt-in coarsens too.
  return { lat: coarsenCoord(lat), lng: coarsenCoord(lng) };
}
