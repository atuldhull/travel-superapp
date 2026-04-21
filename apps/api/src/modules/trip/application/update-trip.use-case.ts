/**
 * Partial update on one of the caller's own trips. Invariants:
 *   - Radius (if provided) must be in (0, 500] km — same rule as
 *     Create. Violations raise `InvalidRadiusError` (422).
 *   - `startsOn` + `endsOn` (if both present in the patch OR one
 *     present + one already on the row) must have startsOn ≤
 *     endsOn → `INVALID_DATE_RANGE` otherwise.
 *   - Missing trip (or owned by another user) → `TRIP_NOT_FOUND`
 *     (404, not 403 — same IDOR-defence policy as GET /trips/:id).
 *   - Empty patch body → no-op, returns the current row without
 *     bumping `version`.
 *
 * Side-effect on date change: if the patch touches `startsOn` OR
 * `endsOn`, any existing itinerary is wiped. Rationale: day-count
 * and the date-keyed rows in `ItineraryDay` would otherwise drift
 * out of sync with the trip's window. Client is expected to
 * re-POST `/trips/:id/itinerary` to regenerate.
 *
 * Installed by prompt [IV.18.2.3.1].
 */
import { Inject, Injectable } from '@nestjs/common';
import { InvalidRadiusError, NotFoundError, ValidationError } from '@app/errors';
import type { Trip } from '../domain/trip.entity';
import { ITINERARY_REPOSITORY, type ItineraryRepository } from './ports/itinerary.repository';
import {
  TRIP_REPOSITORY,
  type TripRepository,
  type UpdateTripPatch,
} from './ports/trip.repository';

const MAX_RADIUS_KM = 500;

export interface UpdateTripCommand {
  readonly tripId: string;
  readonly userId: string;
  readonly patch: UpdateTripPatch;
}

@Injectable()
export class UpdateTripUseCase {
  constructor(
    @Inject(TRIP_REPOSITORY) private readonly trips: TripRepository,
    @Inject(ITINERARY_REPOSITORY) private readonly itinerary: ItineraryRepository,
  ) {}

  async execute(cmd: UpdateTripCommand): Promise<Trip> {
    const { patch } = cmd;

    if (patch.radiusKm !== undefined) {
      if (!Number.isFinite(patch.radiusKm) || patch.radiusKm <= 0) {
        throw new ValidationError(
          'Radius must be a positive number',
          { radiusKm: ['must be > 0'] },
          { radiusKm: patch.radiusKm },
          'INVALID_RADIUS',
        );
      }
      if (patch.radiusKm > MAX_RADIUS_KM) {
        throw new InvalidRadiusError(patch.radiusKm, MAX_RADIUS_KM);
      }
    }

    // Resolve the effective startsOn/endsOn for range validation.
    // We need to look at BOTH the patch and the existing row: a
    // client sending only `endsOn` must still be compared against
    // the already-stored `startsOn`.
    const existing = await this.trips.findByIdForUser(cmd.tripId, cmd.userId);
    if (!existing) {
      throw new NotFoundError(
        `Trip not found: ${cmd.tripId}`,
        { tripId: cmd.tripId },
        'TRIP_NOT_FOUND',
      );
    }
    const effectiveStartsOn = 'startsOn' in patch ? (patch.startsOn ?? null) : existing.startsOn;
    const effectiveEndsOn = 'endsOn' in patch ? (patch.endsOn ?? null) : existing.endsOn;
    if (
      effectiveStartsOn &&
      effectiveEndsOn &&
      effectiveStartsOn.getTime() > effectiveEndsOn.getTime()
    ) {
      throw new ValidationError(
        'startsOn must be before endsOn',
        { dateRange: ['startsOn > endsOn'] },
        {
          startsOn: effectiveStartsOn.toISOString(),
          endsOn: effectiveEndsOn.toISOString(),
        },
        'INVALID_DATE_RANGE',
      );
    }

    const updated = await this.trips.updateForUser(cmd.tripId, cmd.userId, patch);
    if (!updated) {
      // Someone raced a delete between findByIdForUser and
      // updateForUser — treat as 404 same as above.
      throw new NotFoundError(
        `Trip not found: ${cmd.tripId}`,
        { tripId: cmd.tripId },
        'TRIP_NOT_FOUND',
      );
    }

    // Date-range invalidation: wipe itinerary if either date moved.
    const datesChanged =
      ('startsOn' in patch &&
        (existing.startsOn?.getTime() ?? null) !== (effectiveStartsOn?.getTime() ?? null)) ||
      ('endsOn' in patch &&
        (existing.endsOn?.getTime() ?? null) !== (effectiveEndsOn?.getTime() ?? null));
    if (datesChanged) {
      await this.itinerary.clearAll(cmd.tripId);
    }

    return updated;
  }
}
