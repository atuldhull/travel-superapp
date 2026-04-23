/**
 * Confirm a presigned upload actually landed. Flow:
 *
 *   1. Owner-gate the row — wrong id OR wrong owner ⇒ 404 to
 *      defend against IDOR (same policy as Trip CRUD).
 *   2. If the row is already `ready`, return it unchanged
 *      (idempotent — a retry from a flaky client shouldn't 409).
 *   3. HEAD the S3 object — if it's missing, the client never
 *      actually PUT the bytes; return 409 `UPLOAD_NOT_COMPLETED`
 *      without flipping the row.
 *   4. Flip `status` to `ready` via the owner-scoped updateMany
 *      and return the fresh row.
 *
 * Installed by prompt [IV.18.12.1].
 */
import { Inject, Injectable } from '@nestjs/common';
import { ConflictError, NotFoundError } from '@app/errors';
import type { MediaAsset } from '../domain/media-asset.entity';
import { MEDIA_ASSET_REPOSITORY, type MediaAssetRepository } from './ports/media-asset.repository';
import { STORAGE_PROVIDER, type StorageProvider } from './ports/storage-provider';

export interface ConfirmUploadCommand {
  readonly id: string;
  readonly ownerId: string;
}

@Injectable()
export class ConfirmUploadUseCase {
  constructor(
    @Inject(MEDIA_ASSET_REPOSITORY) private readonly repo: MediaAssetRepository,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  async execute(cmd: ConfirmUploadCommand): Promise<MediaAsset> {
    const existing = await this.repo.findByIdForOwner(cmd.id, cmd.ownerId);
    if (!existing) {
      throw new NotFoundError('Media not found', { mediaId: cmd.id }, 'MEDIA_NOT_FOUND');
    }
    if (existing.status === 'ready') {
      return existing;
    }
    const landed = await this.storage.objectExists(existing.s3KeyRaw);
    if (!landed) {
      throw new ConflictError(
        'Upload has not completed',
        { mediaId: cmd.id },
        'UPLOAD_NOT_COMPLETED',
      );
    }
    const updated = await this.repo.markReady(cmd.id, cmd.ownerId);
    if (!updated) {
      // Vanishingly unlikely race: row was deleted between the
      // initial findByIdForOwner and the markReady. Treat as 404.
      throw new NotFoundError('Media not found', { mediaId: cmd.id }, 'MEDIA_NOT_FOUND');
    }
    return updated;
  }
}
