/**
 * Fetch a single trip scoped to the authenticated user — prevents
 * horizontal-read IDOR. Returns `null` so the controller can decide
 * whether to throw NotFoundError (it does).
 *
 * Installed by prompt [IV.18.2.3].
 */
import { Inject, Injectable } from '@nestjs/common';
import type { Trip } from '../domain/trip.entity';
import { TRIP_REPOSITORY, type TripRepository } from './ports/trip.repository';

@Injectable()
export class GetTripUseCase {
  constructor(@Inject(TRIP_REPOSITORY) private readonly trips: TripRepository) {}

  execute(tripId: string, userId: string): Promise<Trip | null> {
    return this.trips.findByIdForUser(tripId, userId);
  }
}
