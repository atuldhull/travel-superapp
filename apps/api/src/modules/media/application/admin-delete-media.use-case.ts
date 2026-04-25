/**
 * Admin media hard-delete. Used for takedowns of abusive content
 * (CSAM, doxxing, etc.). No owner scope.
 *
 * Cascades:
 *   - `MediaAsset.tripId` is `SetNull` on delete → attached trip
 *     survives, just loses this media reference.
 *   - `MediaAsset.memoryBookId` is `SetNull` on delete → attached
 *     memory book survives, just loses this media reference.
 *
 * The S3 object behind `s3KeyRaw` is NOT cleaned up here.
 * Orphan-object sweep is a future cron concern. The trade-off:
 * an immediate-effect takedown verb at the cost of some S3
 * garbage that the sweep eventually picks up.
 *
 * 404 on missing row.
 *
 * Installed by prompt [IV.18.18.4].
 */
import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '@app/errors';
import { MEDIA_ASSET_REPOSITORY, type MediaAssetRepository } from './ports/media-asset.repository';

@Injectable()
export class AdminDeleteMediaUseCase {
  constructor(@Inject(MEDIA_ASSET_REPOSITORY) private readonly media: MediaAssetRepository) {}

  async execute(mediaId: string): Promise<void> {
    const ok = await this.media.adminDelete(mediaId);
    if (!ok) {
      throw new NotFoundError(`Media not found: ${mediaId}`, { mediaId }, 'MEDIA_NOT_FOUND');
    }
  }
}
