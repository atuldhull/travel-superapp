/**
 * Phase 5 (J4) — port for trip comments.
 *
 * `findCommentableTrip` is the publish gate: a comment may only be
 * created on a trip with a non-PRIVATE, published `TripPublication`.
 * It returns that publication's `authorId` so the create use-case
 * can also run the block gate (commenter vs trip author) without a
 * cross-module repository dependency.
 *
 * Installed by prompt [J4].
 */
import type { TripComment, TripCommentWithAuthor } from '../../domain/trip-comment.entity';

export interface CreateCommentInput {
  readonly tripId: string;
  readonly authorId: string;
  readonly body: string;
}

export interface CommentRepository {
  create(input: CreateCommentInput): Promise<TripComment>;
  /** The per-trip thread, oldest-first, capped at `limit`. Joined to
   *  `User` for the author display name; soft-deleted authors' rows
   *  are dropped. */
  listForTrip(tripId: string, limit: number): Promise<readonly TripCommentWithAuthor[]>;
  findById(id: string): Promise<TripComment | null>;
  /** Idempotent hard-delete by id (no-op if absent). */
  delete(id: string): Promise<void>;
  /** Publish gate — resolves to the published trip's `authorId` when
   *  the trip has a non-PRIVATE, published `TripPublication`; `null`
   *  otherwise (never published, unpublished, or PRIVATE). */
  findCommentableTrip(tripId: string): Promise<{ authorId: string } | null>;
  countForTrip(tripId: string): Promise<number>;
}

export const COMMENT_REPOSITORY = Symbol('CommentRepository');
