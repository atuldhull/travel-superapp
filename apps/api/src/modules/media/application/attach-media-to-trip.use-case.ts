/**
 * Attach a MediaAsset to a Trip — or detach, with `tripId = null`.
 *
 * Double owner gate:
 *   1. The media row must belong to the caller.
 *   2. If attaching (not detaching), the trip must ALSO belong to
 *      the caller — you can't attach your photo to someone else's
 *      trip, and you can't use this endpoint to probe whether a
 *      given trip id exists + is owned by someone else (wrong
 *      trip / wrong owner / missing trip all collapse to 404
 *      `TRIP_NOT_FOUND`).
 *
 * Detach is always allowed on your own media, regardless of the
 * media's current `tripId` (so a clean-up flow doesn't need to
 * re-check what it was attached to).
 *
 * Installed by prompt [IV.18.12.2].
 */
import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '@app/errors';
import { TRIP_REPOSITORY, type TripRepository } from '../../trip';
import type { MediaAsset } from '../domain/media-asset.entity';
import { MEDIA_ASSET_REPOSITORY, type MediaAssetRepository } from './ports/media-asset.repository';

export interface AttachMediaToTripCommand {
  readonly mediaId: string;
  readonly ownerId: string;
  readonly tripId: string | null;
}

@Injectable()
export class AttachMediaToTripUseCase {
  constructor(
    @Inject(MEDIA_ASSET_REPOSITORY) private readonly media: MediaAssetRepository,
    @Inject(TRIP_REPOSITORY) private readonly trips: TripRepository,
  ) {}

  async execute(cmd: AttachMediaToTripCommand): Promise<MediaAsset> {
    if (cmd.tripId !== null) {
      const trip = await this.trips.findByIdForUser(cmd.tripId, cmd.ownerId);
      if (!trip) {
        throw new NotFoundError(
          `Trip not found: ${cmd.tripId}`,
          { tripId: cmd.tripId },
          'TRIP_NOT_FOUND',
        );
      }
    }
    const updated = await this.media.setTripForOwner(cmd.mediaId, cmd.ownerId, cmd.tripId);
    if (!updated) {
      throw new NotFoundError(
        `Media not found: ${cmd.mediaId}`,
        { mediaId: cmd.mediaId },
        'MEDIA_NOT_FOUND',
      );
    }
    return updated;
  }
}
