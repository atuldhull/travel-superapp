/**
 * Get one MemoryBook (owner-gated) + the ids of every `ready`
 * `MediaAsset` attached to it. Clients hydrate each asset via
 * `GET /media/:id/download-url` as they render — keeps the book
 * response small + avoids signing N download URLs the client may
 * never open.
 *
 * Installed by prompt [IV.18.12.6].
 */
import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '@app/errors';
import type { MemoryBookWithAssets } from '../domain/memory-book.entity';
import {
  MEMORY_BOOK_REPOSITORY,
  type MemoryBookAssetSummary,
  type MemoryBookRepository,
} from './ports/memory-book.repository';

export interface GetMemoryBookCommand {
  readonly id: string;
  readonly ownerId: string;
}

export interface OwnerMemoryBookWithAssets extends MemoryBookWithAssets {
  readonly assets: readonly MemoryBookAssetSummary[];
}

@Injectable()
export class GetMemoryBookUseCase {
  constructor(@Inject(MEMORY_BOOK_REPOSITORY) private readonly repo: MemoryBookRepository) {}

  async execute(cmd: GetMemoryBookCommand): Promise<OwnerMemoryBookWithAssets> {
    const book = await this.repo.findByIdForOwner(cmd.id, cmd.ownerId);
    if (!book) {
      throw new NotFoundError(
        `Memory book not found: ${cmd.id}`,
        { memoryBookId: cmd.id },
        'MEMORY_BOOK_NOT_FOUND',
      );
    }
    const assets = await this.repo.listAssetSummariesForOwner(cmd.id, cmd.ownerId);
    const assetIds = assets.map((a) => a.id);
    return { book, assetIds, assets };
  }
}
