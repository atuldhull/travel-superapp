/**
 * Create a new `MemoryBook` owned by the caller. Validation:
 *   - `title` non-empty, ≤ 120 chars.
 *   - `theme` ≤ 32 chars; empty coerces to `'classic'` (schema
 *     default). No enum validation — themes are UI-driven strings,
 *     future themes land without a migration.
 *   - `coverS3Key` optional; if provided, caller-scoped validation
 *     (the media asset must be the caller's `ready` upload) is a
 *     follow-up. v1 trusts the string — worst case is a broken
 *     thumbnail.
 *
 * Installed by prompt [IV.18.12.6].
 */
import { Inject, Injectable } from '@nestjs/common';
import { ValidationError } from '@app/errors';
import type { MemoryBook } from '../domain/memory-book.entity';
import { MEMORY_BOOK_REPOSITORY, type MemoryBookRepository } from './ports/memory-book.repository';

export interface CreateMemoryBookCommand {
  readonly ownerId: string;
  readonly title: string;
  readonly theme?: string;
  readonly coverS3Key?: string | null;
}

@Injectable()
export class CreateMemoryBookUseCase {
  constructor(@Inject(MEMORY_BOOK_REPOSITORY) private readonly repo: MemoryBookRepository) {}

  async execute(cmd: CreateMemoryBookCommand): Promise<MemoryBook> {
    const title = cmd.title.trim();
    if (title.length === 0 || title.length > 120) {
      throw new ValidationError(
        'Title must be 1..120 chars',
        { title: ['must be non-empty, ≤ 120 chars'] },
        { length: title.length },
        'INVALID_TITLE',
      );
    }
    const themeRaw = (cmd.theme ?? '').trim();
    if (themeRaw.length > 32) {
      throw new ValidationError(
        'Theme too long',
        { theme: ['must be ≤ 32 chars'] },
        { length: themeRaw.length },
        'INVALID_THEME',
      );
    }
    const theme = themeRaw.length === 0 ? 'classic' : themeRaw;
    return this.repo.create({
      ownerId: cmd.ownerId,
      title,
      theme,
      coverS3Key: cmd.coverS3Key ?? null,
    });
  }
}
