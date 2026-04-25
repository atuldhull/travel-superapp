/**
 * Admin trip hard-delete. Used for takedowns of clearly-abusive
 * content. No owner scope; cascades through Prisma `onDelete`
 * settings to itinerary days + items + votes + expenses + reviews
 * + media (everything user-trip-scoped).
 *
 * 404 on missing row. Idempotent: a second delete on the same id
 * returns 404 — the row is already gone, which is the explicit
 * "your prior call succeeded" signal an admin caller should see.
 *
 * Installed by prompt [IV.18.18.3].
 */
import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '@app/errors';
import { TRIP_REPOSITORY, type TripRepository } from './ports/trip.repository';

@Injectable()
export class AdminDeleteTripUseCase {
  constructor(@Inject(TRIP_REPOSITORY) private readonly trips: TripRepository) {}

  async execute(tripId: string): Promise<void> {
    const ok = await this.trips.adminDelete(tripId);
    if (!ok) {
      throw new NotFoundError(`Trip not found: ${tripId}`, { tripId }, 'TRIP_NOT_FOUND');
    }
  }
}
