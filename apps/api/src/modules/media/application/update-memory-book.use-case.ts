/**
 * Patch a MemoryBook's metadata (title / theme / coverS3Key).
 * Owner-gated; 404 on miss or non-owner. Nothing-to-update
 * returns the current row (no-op, not an error).
 *
 * Installed by prompt [IV.18.12.6].
 */
import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError, ValidationError } from '@app/errors';
import type { MemoryBook } from '../domain/memory-book.entity';
import { MEMORY_BOOK_REPOSITORY, type MemoryBookRepository } from './ports/memory-book.repository';

export interface UpdateMemoryBookCommand {
  readonly id: string;
  readonly ownerId: string;
  readonly title?: string;
  readonly theme?: string;
  readonly coverS3Key?: string | null;
}

@Injectable()
export class UpdateMemoryBookUseCase {
  constructor(@Inject(MEMORY_BOOK_REPOSITORY) private readonly repo: MemoryBookRepository) {}

  async execute(cmd: UpdateMemoryBookCommand): Promise<MemoryBook> {
    const patch: { title?: string; theme?: string; coverS3Key?: string | null } = {};
    if (cmd.title !== undefined) {
      const t = cmd.title.trim();
      if (t.length === 0 || t.length > 120) {
        throw new ValidationError(
          'Title must be 1..120 chars',
          { title: ['must be non-empty, ≤ 120 chars'] },
          { length: t.length },
          'INVALID_TITLE',
        );
      }
      patch.title = t;
    }
    if (cmd.theme !== undefined) {
      const th = cmd.theme.trim();
      if (th.length === 0 || th.length > 32) {
        throw new ValidationError(
          'Theme must be 1..32 chars',
          { theme: ['must be non-empty, ≤ 32 chars'] },
          { length: th.length },
          'INVALID_THEME',
        );
      }
      patch.theme = th;
    }
    if (cmd.coverS3Key !== undefined) patch.coverS3Key = cmd.coverS3Key;

    const updated = await this.repo.updateForOwner(cmd.id, cmd.ownerId, patch);
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
