/**
 * Owner-gated presigned GET URL for a `ready` media asset. The
 * URL is short-lived (5 min) — a UI re-fetches as needed. A
 * missing row OR wrong owner maps to 404 `MEDIA_NOT_FOUND`
 * (IDOR-safe). Requesting a download for a still-`processing`
 * asset is a 409 `UPLOAD_NOT_COMPLETED` — matches the confirm
 * path's error code.
 *
 * Installed by prompt [IV.18.12.1].
 */
import { Inject, Injectable } from '@nestjs/common';
import { ConflictError, NotFoundError } from '@app/errors';
import { CLOCK, type Clock } from '@app/clock';
import { MEDIA_ASSET_REPOSITORY, type MediaAssetRepository } from './ports/media-asset.repository';
import { STORAGE_PROVIDER, type StorageProvider } from './ports/storage-provider';

export interface GetMediaDownloadUrlCommand {
  readonly id: string;
  readonly ownerId: string;
}

export interface GetMediaDownloadUrlResult {
  readonly url: string;
  readonly expiresAt: Date;
}

const DOWNLOAD_EXPIRES_SEC = 5 * 60;

@Injectable()
export class GetMediaDownloadUrlUseCase {
  constructor(
    @Inject(MEDIA_ASSET_REPOSITORY) private readonly repo: MediaAssetRepository,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(cmd: GetMediaDownloadUrlCommand): Promise<GetMediaDownloadUrlResult> {
    const asset = await this.repo.findByIdForOwner(cmd.id, cmd.ownerId);
    if (!asset) {
      throw new NotFoundError('Media not found', { mediaId: cmd.id }, 'MEDIA_NOT_FOUND');
    }
    if (asset.status !== 'ready') {
      throw new ConflictError(
        'Upload has not completed',
        { mediaId: cmd.id, status: asset.status },
        'UPLOAD_NOT_COMPLETED',
      );
    }
    const url = await this.storage.createPresignedDownloadUrl(asset.s3KeyRaw, DOWNLOAD_EXPIRES_SEC);
    const expiresAt = new Date(this.clock.nowMs() + DOWNLOAD_EXPIRES_SEC * 1000);
    return { url, expiresAt };
  }
}
