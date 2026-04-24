/**
 * Attach a MediaAsset to a MemoryBook — or detach, with
 * `memoryBookId: null`. Double owner-gate: both the media AND
 * the target book must belong to the caller. Matches the
 * `attach-media-to-trip` shape exactly ([IV.18.12.2]).
 *
 * Wrong-owner on either side collapses to a 404 with the
 * corresponding code (`MEDIA_NOT_FOUND` vs.
 * `MEMORY_BOOK_NOT_FOUND`).
 *
 * Installed by prompt [IV.18.12.6].
 */
import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '@app/errors';
import type { MediaAsset } from '../domain/media-asset.entity';
import { MEDIA_ASSET_REPOSITORY, type MediaAssetRepository } from './ports/media-asset.repository';
import { MEMORY_BOOK_REPOSITORY, type MemoryBookRepository } from './ports/memory-book.repository';

export interface AttachMediaToBookCommand {
  readonly mediaId: string;
  readonly ownerId: string;
  readonly memoryBookId: string | null;
}

@Injectable()
export class AttachMediaToBookUseCase {
  constructor(
    @Inject(MEDIA_ASSET_REPOSITORY) private readonly media: MediaAssetRepository,
    @Inject(MEMORY_BOOK_REPOSITORY) private readonly books: MemoryBookRepository,
  ) {}

  async execute(cmd: AttachMediaToBookCommand): Promise<MediaAsset> {
    if (cmd.memoryBookId !== null) {
      const book = await this.books.findByIdForOwner(cmd.memoryBookId, cmd.ownerId);
      if (!book) {
        throw new NotFoundError(
          `Memory book not found: ${cmd.memoryBookId}`,
          { memoryBookId: cmd.memoryBookId },
          'MEMORY_BOOK_NOT_FOUND',
        );
      }
    }
    const updated = await this.media.setMemoryBookForOwner(
      cmd.mediaId,
      cmd.ownerId,
      cmd.memoryBookId,
    );
    if (!updated) {
      throw new NotFoundError(
        `Media not found: ${cmd.mediaId}`,
        { mediaId: cmd.mediaId },
        'MEDIA_NOT_FOUND',
      );
    }
    return updated;
  }
}
