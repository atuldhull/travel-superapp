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

/**
 * Histogram of rating buckets (1..5) → row counts. Always contains
 * exactly the 5 keys, with 0 for empty buckets — a target with no
 * reviews returns `{ 1:0, 2:0, 3:0, 4:0, 5:0 }`. Keeps clients
 * trivial: render the bar chart, no key-existence checks.
 */
export type ReviewRatingHistogram = Readonly<Record<1 | 2 | 3 | 4 | 5, number>>;

export interface ReviewSummary {
  readonly targetType: ReviewTargetType;
  readonly targetId: string;
  readonly count: number;
  /** Mean rating; 0 when count==0 (NOT NaN). 2-decimal precision is the consumer concern. */
  readonly average: number;
  readonly histogram: ReviewRatingHistogram;
}

export interface ReviewRepository {
  create(input: CreateReviewInput): Promise<Review>;
  listByTarget(input: ListByTargetInput): Promise<readonly Review[]>;
  listByAuthor(authorId: string, limit: number): Promise<readonly Review[]>;
  findById(id: string): Promise<Review | null>;
  /** Returns `true` iff a row was actually removed (author-scoped). */
  deleteForAuthor(id: string, authorId: string): Promise<boolean>;
  /**
   * Aggregate a target's reviews into `{ count, average, histogram }`.
   * One indexed `groupBy` query against the existing
   * `(targetType, targetId)` Prisma index — O(buckets) regardless of
   * row count. An empty target returns count=0 + zero-filled histogram
   * (not null) so the consumer surface has a single shape.
   */
  aggregateByTarget(targetType: ReviewTargetType, targetId: string): Promise<ReviewSummary>;

  /**
   * V.UX.24 — set the target-owner reply on a review. Conditional
   * update — only writes when `responseBody IS NULL`, so a re-submit
   * returns null (use-case maps that to `REVIEW_RESPONSE_LOCKED`).
   * `responseAt` is stamped to "now" by the adapter.
   */
  setResponse(input: {
    readonly id: string;
    readonly responseBody: string;
  }): Promise<Review | null>;
}

export const REVIEW_REPOSITORY = Symbol('ReviewRepository');
