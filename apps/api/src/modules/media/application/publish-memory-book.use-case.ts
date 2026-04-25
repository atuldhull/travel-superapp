/**
 * Publish (or republish) a MemoryBook — flips `publishedAt` to
 * `now()`. Owner-gated. The bookId itself becomes the public
 * token: `GET /memory-books/public/:id` returns the book to
 * anyone who has the id. CUID has ~130 bits of entropy — enough
 * to be unguessable on its own without a separate share-code
 * scheme. A future slice can layer on per-share TTLs +
 * revocable share codes if/when the product needs them.
 *
 * Republishing (publish on an already-published book) refreshes
 * the timestamp — the operation is idempotent in effect (book
 * stays public) but tracks the most-recent publish time, which
 * a future analytics surface can use ("trending recently
 * published books").
 *
 * Installed by prompt [IV.18.12.7].
 */
import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '@app/errors';
import type { MemoryBook } from '../domain/memory-book.entity';
import { MEMORY_BOOK_REPOSITORY, type MemoryBookRepository } from './ports/memory-book.repository';

export interface PublishMemoryBookCommand {
  readonly id: string;
  readonly ownerId: string;
}

@Injectable()
export class PublishMemoryBookUseCase {
  constructor(@Inject(MEMORY_BOOK_REPOSITORY) private readonly repo: MemoryBookRepository) {}

  async execute(cmd: PublishMemoryBookCommand): Promise<MemoryBook> {
    const updated = await this.repo.setPublishedAtForOwner(cmd.id, cmd.ownerId, new Date());
    if (!updated) {
      throw new NotFoundError(
        `Memory book not found: ${cmd.id}`,
        { memoryBookId: cmd.id },
        'MEMORY_BOOK_NOT_FOUND',
      );
    }
    return updated;
  }
}
