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
 *   4. Flip `status` to `ready` via the owner-scoped updateMany.
 *   5. For `kind: 'image'`, also flip `exifStripped = true` as a
 *      stub — the real strip-then-reupload runs in `media-service`
 *      out-of-band per playbook §3.2. Videos defer entirely to the
 *      worker (transcode + EXIF handling there).
 *      EXIF stub added by `[IV.18.12.14]`.
 *   6. POST.5 — kick off Sharp variant pipeline for images:
 *      download the original, generate thumb + medium WebP, upload
 *      them back under `${s3KeyRaw}.thumb.webp` + `.medium.webp`,
 *      and persist `{label, format, s3Key, …}` rows in
 *      `MediaAsset.variants`. Failures are logged + swallowed —
 *      the asset is already `ready`, and a future reconciliation
 *      job can backfill missing variants without affecting users.
 *
 * Installed by prompt [IV.18.12.1]. Variant pipeline added in [POST.5].
 */
import { Inject, Injectable } from '@nestjs/common';
import { ConflictError, NotFoundError } from '@app/errors';
import { createLogger, type AppLogger } from '@app/logger';
import type { MediaAsset } from '../domain/media-asset.entity';
import { IMAGE_PROCESSOR_PORT, type ImageProcessorPort } from './ports/image-processor.port';
import {
  MEDIA_ASSET_REPOSITORY,
  type MediaAssetRepository,
  type StoredVariant,
} from './ports/media-asset.repository';
import { STORAGE_PROVIDER, type StorageProvider } from './ports/storage-provider';

export interface ConfirmUploadCommand {
  readonly id: string;
  readonly ownerId: string;
}

@Injectable()
export class ConfirmUploadUseCase {
  private readonly logger: AppLogger = createLogger('media.confirm-upload');

  constructor(
    @Inject(MEDIA_ASSET_REPOSITORY) private readonly repo: MediaAssetRepository,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
    @Inject(IMAGE_PROCESSOR_PORT) private readonly imageProcessor: ImageProcessorPort,
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
    if (updated.kind !== 'image') {
      return updated;
    }
    // Stub: a real EXIF strip happens out-of-band in
    // media-service. We just flag the row so location-derived
    // features can gate on it. Failure here is non-fatal — the
    // ready transition is already committed; an unflagged image
    // simply gets re-stripped by a future reconciliation job.
    const stripped = await this.repo.markExifStrippedForOwner(cmd.id, cmd.ownerId);
    const afterStrip = stripped ?? updated;

    // POST.5 — Sharp variant pipeline. Best-effort; never throws
    // through to the caller. Failure scenarios we tolerate: libvips
    // can't decode the bytes (corrupt upload), S3 PUT fails on a
    // variant key, DB write conflicts on the variants column.
    const withVariants = await this.generateVariants(afterStrip);
    return withVariants ?? afterStrip;
  }

  private async generateVariants(asset: MediaAsset): Promise<MediaAsset | null> {
    try {
      const original = await this.storage.getObject(asset.s3KeyRaw);
      const generated = await this.imageProcessor.generate(original);
      const stored: StoredVariant[] = [];
      for (const v of generated) {
        const s3Key = `${asset.s3KeyRaw}.${v.label}.${v.format}`;
        await this.storage.putObject(s3Key, v.buffer, `image/${v.format}`);
        stored.push({
          label: v.label,
          format: v.format,
          s3Key,
          width: v.width,
          height: v.height,
          bytes: v.bytes,
          sha256: v.sha256,
        });
      }
      const updated = await this.repo.updateVariants(asset.id, asset.ownerId, stored);
      this.logger.info(
        {
          mediaId: asset.id,
          ownerId: asset.ownerId,
          variantCount: stored.length,
          totalBytes: stored.reduce((sum, v) => sum + v.bytes, 0),
        },
        'media_variants_generated',
      );
      return updated;
    } catch (err) {
      this.logger.warn(
        {
          mediaId: asset.id,
          ownerId: asset.ownerId,
          err: err instanceof Error ? err.message : String(err),
        },
        'media_variants_failed_nonfatal',
      );
      return null;
    }
  }
}
