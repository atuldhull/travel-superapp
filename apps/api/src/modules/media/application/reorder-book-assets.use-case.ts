/**
 * V.UX.12 — drag-reorder of memory-book assets. Owner-gated;
 * the request body is the desired ordering as an array of
 * asset ids. The list must be a strict permutation of the
 * currently-attached `ready` assets — no missing, no extras,
 * no duplicates. We persist the new ordering by writing each
 * asset's array index into `MediaAsset.position` inside a
 * single transaction, so a half-applied reorder can never
 * leak.
 *
 * Installed by prompt [V.UX.12].
 */
import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError, ValidationError } from '@app/errors';
import { MEMORY_BOOK_REPOSITORY, type MemoryBookRepository } from './ports/memory-book.repository';

export interface ReorderBookAssetsCommand {
  readonly memoryBookId: string;
  readonly ownerId: string;
  readonly assetIds: readonly string[];
}

@Injectable()
export class ReorderBookAssetsUseCase {
  constructor(@Inject(MEMORY_BOOK_REPOSITORY) private readonly repo: MemoryBookRepository) {}

  async execute(cmd: ReorderBookAssetsCommand): Promise<void> {
    const book = await this.repo.findByIdForOwner(cmd.memoryBookId, cmd.ownerId);
    if (!book) {
      throw new NotFoundError(
        `Memory book not found: ${cmd.memoryBookId}`,
        { memoryBookId: cmd.memoryBookId },
        'MEMORY_BOOK_NOT_FOUND',
      );
    }

    const seen = new Set<string>();
    for (const id of cmd.assetIds) {
      if (seen.has(id)) {
        throw new ValidationError(
          'Asset order list contains duplicates',
          { assetIds: ['must be unique'] },
          { duplicateId: id },
          'INVALID_ASSET_ORDER',
        );
      }
      seen.add(id);
    }

    const current = await this.repo.listAssetSummariesForOwner(cmd.memoryBookId, cmd.ownerId);
    const currentIds = new Set(current.map((a) => a.id));

    if (cmd.assetIds.length !== currentIds.size) {
      throw new ValidationError(
        'Asset order list does not match attached assets',
        { assetIds: ['length must equal number of attached assets'] },
        { provided: cmd.assetIds.length, attached: currentIds.size },
        'INVALID_ASSET_ORDER',
      );
    }
    for (const id of cmd.assetIds) {
      if (!currentIds.has(id)) {
        throw new ValidationError(
          'Asset is not attached to this book',
          { assetIds: [`${id} is not attached`] },
          { assetId: id },
          'INVALID_ASSET_ORDER',
        );
      }
    }

    await this.repo.reorderAssetsForOwner(cmd.memoryBookId, cmd.ownerId, cmd.assetIds);
  }
}
