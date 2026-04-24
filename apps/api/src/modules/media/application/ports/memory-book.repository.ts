/**
 * Port for `MemoryBook` persistence. Narrow v1 surface — create,
 * find-by-id (owner-gated), list-mine, update metadata (title /
 * coverS3Key / theme), delete, plus the asset-ids lookup the
 * read surface needs.
 *
 * Media-asset ↔ book attachment lives on the `MediaAssetRepository`
 * (same port that already owns `setTripForOwner`). That repo
 * gets a new `setMemoryBookForOwner` method — symmetric shape.
 *
 * Installed by prompt [IV.18.12.6].
 */
import type { MemoryBook } from '../../domain/memory-book.entity';

export interface CreateMemoryBookInput {
  readonly ownerId: string;
  readonly title: string;
  readonly theme: string;
  readonly coverS3Key: string | null;
}

export interface UpdateMemoryBookInput {
  readonly title?: string;
  readonly theme?: string;
  readonly coverS3Key?: string | null;
}

export interface MemoryBookRepository {
  create(input: CreateMemoryBookInput): Promise<MemoryBook>;
  /** Owner-gated. `null` on miss OR wrong-owner (IDOR-safe). */
  findByIdForOwner(id: string, ownerId: string): Promise<MemoryBook | null>;
  /** Most-recent-first; default caller-clamped. */
  listForOwner(ownerId: string, limit: number): Promise<readonly MemoryBook[]>;
  /** Atomic partial update scoped to owner. Returns updated row
   *  or `null` if id/owner don't match. */
  updateForOwner(
    id: string,
    ownerId: string,
    patch: UpdateMemoryBookInput,
  ): Promise<MemoryBook | null>;
  /** Owner-scoped delete; returns `true` iff a row was removed.
   *  Book-scoped `MediaAsset.memoryBookId` gets NULLed by the
   *  FK's `onDelete: SetNull`. */
  deleteForOwner(id: string, ownerId: string): Promise<boolean>;
  /** Owner-scoped list of `MediaAsset.id`s attached to this book.
   *  v1 returns `ready`-only (same filter the trip-listing uses).
   *  Ordered by `MediaAsset.createdAt` desc. */
  listAssetIdsForOwner(bookId: string, ownerId: string): Promise<readonly string[]>;
}

export const MEMORY_BOOK_REPOSITORY = Symbol('MemoryBookRepository');
