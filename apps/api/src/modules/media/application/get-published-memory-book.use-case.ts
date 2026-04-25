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
import { MEMORY_BOOK_REPOSITORY, type MemoryBookRepository } from './ports/memory-book.repository';

@Injectable()
export class GetPublishedMemoryBookUseCase {
  constructor(@Inject(MEMORY_BOOK_REPOSITORY) private readonly repo: MemoryBookRepository) {}

  async execute(id: string): Promise<MemoryBookWithAssets> {
    const book = await this.repo.findPublishedById(id);
    if (!book) {
      throw new NotFoundError(
        `Memory book not found: ${id}`,
        { memoryBookId: id },
        'MEMORY_BOOK_NOT_FOUND',
      );
    }
    // Owner-scoped asset listing reuses the existing repo method —
    // safe because the public-read gate already passed (the book
    // is published; its asset list is fair game).
    const assetIds = await this.repo.listAssetIdsForOwner(id, book.ownerId);
    return { book, assetIds };
  }
}
