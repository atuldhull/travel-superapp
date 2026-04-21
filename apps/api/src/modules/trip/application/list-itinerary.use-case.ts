/**
 * List the itinerary days for one of the caller's own trips. Scoped
 * via `TripRepository.findByIdForUser` so cross-user reads 404 (not
 * 403) — matches the IDOR-defence policy on GET /trips/:id.
 *
 * Installed by prompt [IV.18.2.4].
 */
import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '@app/errors';
import type { ItineraryDay } from '../domain/itinerary.entity';
import { ITINERARY_REPOSITORY, type ItineraryRepository } from './ports/itinerary.repository';
import { TRIP_REPOSITORY, type TripRepository } from './ports/trip.repository';

@Injectable()
export class ListItineraryUseCase {
  constructor(
    @Inject(TRIP_REPOSITORY) private readonly trips: TripRepository,
    @Inject(ITINERARY_REPOSITORY) private readonly itinerary: ItineraryRepository,
  ) {}

  async execute(tripId: string, userId: string): Promise<readonly ItineraryDay[]> {
    const trip = await this.trips.findByIdForUser(tripId, userId);
    if (!trip) {
      throw new NotFoundError(`Trip not found: ${tripId}`, { tripId }, 'TRIP_NOT_FOUND');
    }
    return this.itinerary.listDays(tripId);
  }
}
