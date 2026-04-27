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

  /**
   * V.UX.11 — owner-scoped asset summaries (id + caption + position
   * + kind). Same `ready`-only filter as `listAssetIdsForOwner`.
   * Ordered by `position` ascending, `createdAt` ascending as a
   * tiebreaker, so the story-mode order is deterministic before
   * the owner does any explicit reordering.
   */
  listAssetSummariesForOwner(
    bookId: string,
    ownerId: string,
  ): Promise<readonly MemoryBookAssetSummary[]>;

  /**
   * V.UX.11 — public twin of the above. No owner filter (the book
   * is already gated as published in the use-case). Same shape and
   * ordering.
   */
  listPublishedAssetSummariesForBook(bookId: string): Promise<readonly MemoryBookAssetSummary[]>;

  /**
   * Owner-scoped publish toggle. Pass a `Date` to publish (or
   * republish — refresh the `publishedAt` timestamp), `null` to
   * unpublish. Returns the updated row, or `null` on miss /
   * non-owner. [IV.18.12.7]
   */
  setPublishedAtForOwner(
    id: string,
    ownerId: string,
    publishedAt: Date | null,
  ): Promise<MemoryBook | null>;

  /**
   * Public read path — no owner filter. Returns the book ONLY if
   * `publishedAt IS NOT NULL`; an unpublished book (or a missing
   * id) returns `null`, mapped to 404 at the use-case. The
   * cuid id itself is the unguessable token (~130 bits of
   * entropy); no separate share code in v1. [IV.18.12.7]
   */
  findPublishedById(id: string): Promise<MemoryBook | null>;

  /**
   * Public asset-membership probe. Returns the asset's storage
   * key + `ready` status iff:
   *   - The book is published (`publishedAt IS NOT NULL`).
   *   - The asset is currently attached (`memoryBookId === bookId`).
   *   - The asset is `ready` (no half-uploaded thumbnails leak).
   * Returns `null` otherwise. Used by the public download-URL
   * surface to gate presigned-URL generation. [IV.18.12.7]
   */
  findPublishedAssetForBook(
    bookId: string,
    assetId: string,
  ): Promise<{ readonly s3KeyRaw: string } | null>;

  /**
   * Public listing of currently-published memory books. Returns at
   * most `limit` rows, ordered by `publishedAt DESC` (most-recently
   * published first). Cross-user — drives the public marketing /
   * discovery surface. Excludes unpublished and soft-purged user
   * rows automatically (the FK cascade nukes the books too).
   *
   * Added by `[IV.18.13.1]`.
   */
  listPublished(limit: number): Promise<readonly MemoryBook[]>;
}

/**
 * V.UX.11 — slim per-asset summary surfaced on the memory-book
 * read paths. Lets the public viewer + owner editor render rich
 * thumbnail rows without round-tripping per-asset.
 */
export interface MemoryBookAssetSummary {
  readonly id: string;
  readonly kind: 'image' | 'video';
  readonly caption: string | null;
  readonly position: number;
}

export const MEMORY_BOOK_REPOSITORY = Symbol('MemoryBookRepository');
