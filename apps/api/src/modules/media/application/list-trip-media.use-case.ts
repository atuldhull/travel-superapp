/**
 * List the caller's `ready` media rows attached to a given trip.
 * The trip's owner gate runs first so a stranger can't use this
 * endpoint to probe whether a guessed trip id exists.
 *
 * Owner-gated listing only — a shared-trip-read surface that lets
 * the share-code recipient see the trip's photos is a bigger
 * slice (needs a publicly-resolvable media URL contract) and
 * lands separately.
 *
 * Default 50, cap 200 — same shape as every other "list mine"
 * surface in the codebase.
 *
 * Installed by prompt [IV.18.12.2].
 */
import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '@app/errors';
import { TRIP_REPOSITORY, type TripRepository } from '../../trip/application/ports/trip.repository';
import type { MediaAsset } from '../domain/media-asset.entity';
import { MEDIA_ASSET_REPOSITORY, type MediaAssetRepository } from './ports/media-asset.repository';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export interface ListTripMediaCommand {
  readonly tripId: string;
  readonly ownerId: string;
  readonly limit?: number;
}

@Injectable()
export class ListTripMediaUseCase {
  constructor(
    @Inject(MEDIA_ASSET_REPOSITORY) private readonly media: MediaAssetRepository,
    @Inject(TRIP_REPOSITORY) private readonly trips: TripRepository,
  ) {}

  async execute(cmd: ListTripMediaCommand): Promise<readonly MediaAsset[]> {
    const trip = await this.trips.findByIdForUser(cmd.tripId, cmd.ownerId);
    if (!trip) {
      throw new NotFoundError(
        `Trip not found: ${cmd.tripId}`,
        { tripId: cmd.tripId },
        'TRIP_NOT_FOUND',
      );
    }
    const clamped =
      cmd.limit === undefined
        ? DEFAULT_LIMIT
        : Math.max(1, Math.min(MAX_LIMIT, Math.floor(cmd.limit)));
    return this.media.listForTripOwner(cmd.tripId, cmd.ownerId, clamped);
  }
}
