/**
 * Port for Review persistence. v1 surface is create / list by
 * target / list mine / delete-for-author. Edit (PATCH) deferred
 * to a follow-up — delete + re-create covers the UX.
 *
 * Installed by prompt [IV.18.12.5].
 */
import type { Review, ReviewTargetType } from '../../domain/review.entity';

export interface CreateReviewInput {
  readonly authorId: string;
  readonly tripId: string | null;
  readonly targetType: ReviewTargetType;
  readonly targetId: string;
  readonly rating: number;
  readonly body: string;
  readonly language: string;
}

export interface ListByTargetInput {
  readonly targetType: ReviewTargetType;
  readonly targetId: string;
  readonly limit: number;
}

export interface ReviewRepository {
  create(input: CreateReviewInput): Promise<Review>;
  listByTarget(input: ListByTargetInput): Promise<readonly Review[]>;
  listByAuthor(authorId: string, limit: number): Promise<readonly Review[]>;
  findById(id: string): Promise<Review | null>;
  /** Returns `true` iff a row was actually removed (author-scoped). */
  deleteForAuthor(id: string, authorId: string): Promise<boolean>;
}

export const REVIEW_REPOSITORY = Symbol('ReviewRepository');
