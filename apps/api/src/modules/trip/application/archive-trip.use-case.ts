/**
 * V.UX.30 — owner-scoped trip archive / unarchive.
 *
 * Same IDOR posture as the rest of the trip surface: missing trip OR
 * trip owned by a different user both collapse to 404 TRIP_NOT_FOUND.
 *
 * Idempotent: re-archiving an already-archived trip succeeds (the
 * `archivedAt` timestamp is refreshed, but the user can't tell — the
 * UX intent is "make sure this trip is in the Archived bucket").
 *
 * Installed by prompt [V.UX.30].
 */
import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '@app/errors';
import type { Trip } from '../domain/trip.entity';
import { TRIP_REPOSITORY, type TripRepository } from './ports/trip.repository';

export interface ArchiveTripCommand {
  readonly id: string;
  readonly userId: string;
  readonly archive: boolean;
}

@Injectable()
export class ArchiveTripUseCase {
  constructor(@Inject(TRIP_REPOSITORY) private readonly trips: TripRepository) {}

  async execute(cmd: ArchiveTripCommand): Promise<Trip> {
    const updated = await this.trips.setArchivedForUser(cmd.id, cmd.userId, cmd.archive);
    if (!updated) {
      throw new NotFoundError(`Trip not found: ${cmd.id}`, { tripId: cmd.id }, 'TRIP_NOT_FOUND');
    }
    return updated;
  }
}
