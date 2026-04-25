/**
 * Admin trip archive — soft moderation. Flips `status = 'archived'`
 * on any trip; no owner scope. The trip stays in the DB; the owner
 * can unarchive via the existing PATCH /trips/:id flow if/when
 * appropriate.
 *
 * 404 path: trip row is missing.
 *
 * Installed by prompt [IV.18.18.3].
 */
import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '@app/errors';
import { TRIP_REPOSITORY, type TripRepository } from './ports/trip.repository';

@Injectable()
export class AdminArchiveTripUseCase {
  constructor(@Inject(TRIP_REPOSITORY) private readonly trips: TripRepository) {}

  async execute(tripId: string): Promise<void> {
    const ok = await this.trips.adminArchive(tripId);
    if (!ok) {
      throw new NotFoundError(`Trip not found: ${tripId}`, { tripId }, 'TRIP_NOT_FOUND');
    }
  }
}
