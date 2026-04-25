/**
 * Public discovery surface — lists currently-published memory
 * books across all users, most-recently-published first. Drives
 * the marketing / "explore" frontend without needing an account.
 *
 * Default limit 20, cap 100 — keeps the page payload bounded and
 * the prom histogram of /memory-books/featured-latency well-shaped
 * for any deployment.
 *
 * No owner gate (it's a public surface). The repository's
 * `listPublished` already filters to rows with non-null
 * `publishedAt`; FK cascade on a user's soft-purge removes their
 * books too, so a purged user's previously-published book won't
 * leak.
 *
 * Installed by prompt [IV.18.13.1].
 */
import { Inject, Injectable } from '@nestjs/common';
import type { MemoryBook } from '../domain/memory-book.entity';
import { MEMORY_BOOK_REPOSITORY, type MemoryBookRepository } from './ports/memory-book.repository';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

@Injectable()
export class ListPublishedMemoryBooksUseCase {
  constructor(@Inject(MEMORY_BOOK_REPOSITORY) private readonly repo: MemoryBookRepository) {}

  async execute(limit?: number): Promise<readonly MemoryBook[]> {
    const clamped =
      limit === undefined ? DEFAULT_LIMIT : Math.max(1, Math.min(MAX_LIMIT, Math.floor(limit)));
    return this.repo.listPublished(clamped);
  }
}
