/**
 * V.UX.8 lock / unlock. The group-trip organiser flips a trip's
 * status to `published` to "freeze" the plan — collaborators with an
 * active TripShare can still view + vote + record expenses, but only
 * the owner can mutate the itinerary or trip metadata. Unlock flips
 * back to `draft`.
 *
 * Status reuse rationale: rather than add a `lockedAt` column, the
 * existing TripStatus enum (draft / published / archived) gives us
 * "published === locked" semantics for free. Avoids a migration; the
 * UI already renders a `published` badge.
 *
 * Owner-only (no share path) — locking is a final-say verb. Missing
 * trip / wrong owner collapses to 404 `TRIP_NOT_FOUND`, same IDOR-
 * safe shape every other Trip endpoint uses.
 *
 * Installed by prompt [V.UX.8].
 */
import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '@app/errors';
import type { Trip } from '../domain/trip.entity';
import { TRIP_REPOSITORY, type TripRepository } from './ports/trip.repository';

@Injectable()
export class LockTripUseCase {
  constructor(@Inject(TRIP_REPOSITORY) private readonly trips: TripRepository) {}

  async execute(tripId: string, userId: string): Promise<Trip> {
    const trip = await this.trips.findByIdForUser(tripId, userId);
    if (!trip) {
      throw new NotFoundError(`Trip not found: ${tripId}`, { tripId }, 'TRIP_NOT_FOUND');
    }
    if (trip.status === 'published') return trip;
    await this.trips.updateStatus(tripId, 'published');
    return { ...trip, status: 'published', updatedAt: new Date() };
  }
}

@Injectable()
export class UnlockTripUseCase {
  constructor(@Inject(TRIP_REPOSITORY) private readonly trips: TripRepository) {}

  async execute(tripId: string, userId: string): Promise<Trip> {
    const trip = await this.trips.findByIdForUser(tripId, userId);
    if (!trip) {
      throw new NotFoundError(`Trip not found: ${tripId}`, { tripId }, 'TRIP_NOT_FOUND');
    }
    if (trip.status === 'draft') return trip;
    await this.trips.updateStatus(tripId, 'draft');
    return { ...trip, status: 'draft', updatedAt: new Date() };
  }
}
