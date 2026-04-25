/**
 * Public read for a single `MediaAsset` belonging to a published
 * `MemoryBook`. Returns a short-lived (5 min) presigned download
 * URL the unauth'd viewer can hit directly.
 *
 * Three-clause gate enforced inside the repo's
 * `findPublishedAssetForBook` (single SQL query):
 *   1. Asset is `ready`.
 *   2. Asset's `memoryBookId === bookId`.
 *   3. Book's `publishedAt IS NOT NULL`.
 * Any failed clause collapses to 404 — no leak of which gate
 * failed.
 *
 * Already-issued URLs survive an unpublish call for their TTL
 * window — that's an S3 contract, not server-enforceable.
 *
 * Installed by prompt [IV.18.12.7].
 */
import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '@app/errors';
import { MEMORY_BOOK_REPOSITORY, type MemoryBookRepository } from './ports/memory-book.repository';
import { STORAGE_PROVIDER, type StorageProvider } from './ports/storage-provider';

export interface GetPublishedAssetDownloadUrlCommand {
  readonly bookId: string;
  readonly assetId: string;
}

export interface GetPublishedAssetDownloadUrlResult {
  readonly url: string;
  readonly expiresAt: Date;
}

const DOWNLOAD_TTL_SECS = 5 * 60;

@Injectable()
export class GetPublishedAssetDownloadUrlUseCase {
  constructor(
    @Inject(MEMORY_BOOK_REPOSITORY) private readonly repo: MemoryBookRepository,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  async execute(
    cmd: GetPublishedAssetDownloadUrlCommand,
  ): Promise<GetPublishedAssetDownloadUrlResult> {
    const asset = await this.repo.findPublishedAssetForBook(cmd.bookId, cmd.assetId);
    if (!asset) {
      throw new NotFoundError(
        `Asset not found in published book`,
        { memoryBookId: cmd.bookId, mediaId: cmd.assetId },
        'MEDIA_NOT_FOUND',
      );
    }
    const url = await this.storage.createPresignedDownloadUrl(asset.s3KeyRaw, DOWNLOAD_TTL_SECS);
    return {
      url,
      expiresAt: new Date(Date.now() + DOWNLOAD_TTL_SECS * 1000),
    };
  }
}
