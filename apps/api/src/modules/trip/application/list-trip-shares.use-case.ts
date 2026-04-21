/**
 * Owner-only listing of every share code minted for a trip — active
 * AND revoked. Clients use this to render a "your active shares"
 * panel and to find a share id/code when the caller has lost the
 * original response.
 *
 * Ownership gate runs FIRST via `TripRepository.findByIdForUser`.
 * A miss (trip doesn't exist OR is owned by another user) → 404
 * `TRIP_NOT_FOUND`, same as every other Trip endpoint. Without the
 * gate, a non-owner calling `GET /trips/:id/shares` could probe
 * existence by observing empty vs 404 responses.
 *
 * Installed by prompt [IV.18.2.15].
 */
import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '@app/errors';
import type { TripShare } from '../domain/trip-share.entity';
import { TRIP_REPOSITORY, type TripRepository } from './ports/trip.repository';
import { TRIP_SHARE_REPOSITORY, type TripShareRepository } from './ports/trip-share.repository';

@Injectable()
export class ListTripSharesUseCase {
  constructor(
    @Inject(TRIP_REPOSITORY) private readonly trips: TripRepository,
    @Inject(TRIP_SHARE_REPOSITORY) private readonly shares: TripShareRepository,
  ) {}

  async execute(tripId: string, ownerId: string): Promise<readonly TripShare[]> {
    const trip = await this.trips.findByIdForUser(tripId, ownerId);
    if (!trip) {
      throw new NotFoundError(`Trip not found: ${tripId}`, { tripId }, 'TRIP_NOT_FOUND');
    }
    return this.shares.listByTripForOwner(tripId, ownerId);
  }
}
