/**
 * Issue a short-lived presigned PUT URL for an S3-compatible
 * upload, and insert a matching `MediaAsset` row in `processing`
 * status. The client PUTs the bytes directly to object storage,
 * then calls the confirm endpoint — the API never touches the
 * object bytes on the upload path.
 *
 * Row is inserted BEFORE the URL is returned so confirm can
 * owner-gate the flip without a follow-up "was this mine"
 * lookup. A row whose object never lands stays in `processing`
 * forever — a cleanup worker can reap them; v1 just tolerates
 * the drift.
 *
 * Installed by prompt [IV.18.12.1].
 */
import { randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { MediaAsset, MediaKind } from '../domain/media-asset.entity';
import { MEDIA_ASSET_REPOSITORY, type MediaAssetRepository } from './ports/media-asset.repository';
import { STORAGE_PROVIDER, type StorageProvider } from './ports/storage-provider';

export interface CreateUploadUrlCommand {
  readonly ownerId: string;
  readonly kind: MediaKind;
  readonly contentType: string;
  readonly tripId: string | null;
}

export interface CreateUploadUrlResult {
  readonly asset: MediaAsset;
  readonly uploadUrl: string;
  readonly expiresAt: Date;
}

const UPLOAD_EXPIRES_SEC = 15 * 60;

@Injectable()
export class CreateUploadUrlUseCase {
  constructor(
    @Inject(MEDIA_ASSET_REPOSITORY) private readonly repo: MediaAssetRepository,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  async execute(cmd: CreateUploadUrlCommand): Promise<CreateUploadUrlResult> {
    const suffix = randomBytes(8).toString('hex');
    // Key shape is `ownerId/{random}/{random}` — MinIO/S3 treat `/`
    // as a visual delimiter only; no directories are created.
    // Owner-prefixing keeps bucket listing tidy + makes per-user
    // lifecycle policies trivial later.
    const ownerSegment = cmd.ownerId;
    const idSegment = randomBytes(8).toString('hex');
    const key = `${ownerSegment}/${idSegment}/${suffix}`;

    const asset = await this.repo.create({
      ownerId: cmd.ownerId,
      tripId: cmd.tripId,
      kind: cmd.kind,
      s3KeyRaw: key,
    });

    const uploadUrl = await this.storage.createPresignedUploadUrl({
      key,
      contentType: cmd.contentType,
      expiresSec: UPLOAD_EXPIRES_SEC,
    });

    const expiresAt = new Date(Date.now() + UPLOAD_EXPIRES_SEC * 1000);
    return { asset, uploadUrl, expiresAt };
  }
}
