/**
 * List the caller's own MemoryBooks, most-recent-first.
 * Default 50, cap 200 — same shape as every other "list mine".
 *
 * Installed by prompt [IV.18.12.6].
 */
import { Inject, Injectable } from '@nestjs/common';
import type { MemoryBook } from '../domain/memory-book.entity';
import { MEMORY_BOOK_REPOSITORY, type MemoryBookRepository } from './ports/memory-book.repository';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

@Injectable()
export class ListMemoryBooksUseCase {
  constructor(@Inject(MEMORY_BOOK_REPOSITORY) private readonly repo: MemoryBookRepository) {}

  async execute(ownerId: string, limit?: number): Promise<readonly MemoryBook[]> {
    const clamped =
      limit === undefined ? DEFAULT_LIMIT : Math.max(1, Math.min(MAX_LIMIT, Math.floor(limit)));
    return this.repo.listForOwner(ownerId, clamped);
  }
}
