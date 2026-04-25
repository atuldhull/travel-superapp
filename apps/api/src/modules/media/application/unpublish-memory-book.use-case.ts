/**
 * Unpublish a MemoryBook — clears `publishedAt`. Public read
 * surfaces (`GET /memory-books/public/:id` + the per-asset
 * download-url surface) immediately stop returning the book.
 * Already-issued presigned download URLs continue to work for
 * their TTL window (5 min) — that's an S3 contract, not a
 * server-side gate.
 *
 * Idempotent: unpublishing an already-unpublished book is a
 * no-op success; the row exists, the timestamp is null, the
 * caller's intent (book is private) is satisfied.
 *
 * Installed by prompt [IV.18.12.7].
 */
import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '@app/errors';
import type { MemoryBook } from '../domain/memory-book.entity';
import { MEMORY_BOOK_REPOSITORY, type MemoryBookRepository } from './ports/memory-book.repository';

export interface UnpublishMemoryBookCommand {
  readonly id: string;
  readonly ownerId: string;
}

@Injectable()
export class UnpublishMemoryBookUseCase {
  constructor(@Inject(MEMORY_BOOK_REPOSITORY) private readonly repo: MemoryBookRepository) {}

  async execute(cmd: UnpublishMemoryBookCommand): Promise<MemoryBook> {
    const updated = await this.repo.setPublishedAtForOwner(cmd.id, cmd.ownerId, null);
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
