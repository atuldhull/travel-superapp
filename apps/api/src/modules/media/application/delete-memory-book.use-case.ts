/**
 * Delete a MemoryBook the caller owns. Any attached `MediaAsset`
 * rows are NOT deleted — the schema's `memoryBookId` FK is
 * `onDelete: SetNull`, so the assets stay in the library but
 * lose their book membership. That's the right default: users
 * don't expect "delete my Paris album" to also nuke the
 * underlying photos.
 *
 * 404 on missing OR non-owner (IDOR-safe).
 *
 * Installed by prompt [IV.18.12.6].
 */
import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '@app/errors';
import { MEMORY_BOOK_REPOSITORY, type MemoryBookRepository } from './ports/memory-book.repository';

export interface DeleteMemoryBookCommand {
  readonly id: string;
  readonly ownerId: string;
}

@Injectable()
export class DeleteMemoryBookUseCase {
  constructor(@Inject(MEMORY_BOOK_REPOSITORY) private readonly repo: MemoryBookRepository) {}

  async execute(cmd: DeleteMemoryBookCommand): Promise<void> {
    const removed = await this.repo.deleteForOwner(cmd.id, cmd.ownerId);
    if (!removed) {
      throw new NotFoundError(
        `Memory book not found: ${cmd.id}`,
        { memoryBookId: cmd.id },
        'MEMORY_BOOK_NOT_FOUND',
      );
    }
  }
}
