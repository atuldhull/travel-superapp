/**
 * Public read of a published MemoryBook. No auth required (the
 * controller marks the route `@Public()`).
 *
 * 404 on:
 *   - missing book id, OR
 *   - book exists but `publishedAt` is null (unpublished).
 * Both signals collapse so a stranger probing the id space
 * learns nothing about whether the book exists privately.
 *
 * Returns book metadata + the list of `ready` `MediaAsset` ids
 * attached to the book. Clients hydrate per-asset thumbnails via
 * `GET /memory-books/public/:bookId/assets/:assetId/download-url`
 * — same shape as the authed `/media/:id/download-url` flow.
 *
 * Installed by prompt [IV.18.12.7].
 */
import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '@app/errors';
import type { MemoryBookWithAssets } from '../domain/memory-book.entity';
import {
  MEMORY_BOOK_REPOSITORY,
  type MemoryBookAssetSummary,
  type MemoryBookRepository,
} from './ports/memory-book.repository';

export interface PublishedMemoryBookWithAssets extends MemoryBookWithAssets {
  readonly assets: readonly MemoryBookAssetSummary[];
}

@Injectable()
export class GetPublishedMemoryBookUseCase {
  constructor(@Inject(MEMORY_BOOK_REPOSITORY) private readonly repo: MemoryBookRepository) {}

  async execute(id: string): Promise<PublishedMemoryBookWithAssets> {
    const book = await this.repo.findPublishedById(id);
    if (!book) {
      throw new NotFoundError(
        `Memory book not found: ${id}`,
        { memoryBookId: id },
        'MEMORY_BOOK_NOT_FOUND',
      );
    }
    const assets = await this.repo.listPublishedAssetSummariesForBook(id);
    const assetIds = assets.map((a) => a.id);
    return { book, assetIds, assets };
  }
}
