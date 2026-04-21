/**
 * List the authenticated user's own trips. Newest first. Limit
 * clamped by the repo — the controller passes a Zod-validated
 * number but we trust-but-verify one more time here.
 *
 * Installed by prompt [IV.18.2.3].
 */
import { Inject, Injectable } from '@nestjs/common';
import type { Trip } from '../domain/trip.entity';
import { TRIP_REPOSITORY, type TripRepository } from './ports/trip.repository';

@Injectable()
export class ListTripsUseCase {
  constructor(@Inject(TRIP_REPOSITORY) private readonly trips: TripRepository) {}

  execute(userId: string, limit = 20): Promise<readonly Trip[]> {
    return this.trips.listByUser(userId, limit);
  }
}
