/**
 * `TripComment` domain entity. A comment on a published trip (Phase 5
 * J4). Flat (no threading) in v1.
 *
 * DDD refactor by [G4.1]: the body validation (T1 non-empty +
 * T2 ≤ MAX_COMMENT_LENGTH after trim) moved off
 * `CreateCommentUseCase` and onto `TripComment.create()`. The
 * commentability gate (trip must be published) + block gate stay in
 * the use-case because they need repository access — the entity owns
 * data invariants only.
 *
 * Installed by prompt [J4]; entity-ized by [G4.1].
 */
import { ValidationError } from '@app/errors';

/** Max comment length — long enough for a real remark, short enough
 *  that the thread stays a thread (not a forum of essays). Exported
 *  for error-message formatting elsewhere. */
export const MAX_COMMENT_LENGTH = 1000;

/** Input shape for `TripComment.create()` — the new-comment payload
 *  BEFORE the DB assigns id + timestamps. */
export interface CreateTripCommentInput {
  readonly tripId: string;
  readonly authorId: string;
  readonly body: string;
}

/** Row shape returned by the Prisma adapter — id + timestamps filled
 *  in by the DB. */
export interface TripCommentPersistenceRow {
  readonly id: string;
  readonly tripId: string;
  readonly authorId: string;
  readonly body: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export class TripComment {
  readonly id: string;
  readonly tripId: string;
  readonly authorId: string;
  readonly body: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(row: TripCommentPersistenceRow) {
    this.id = row.id;
    this.tripId = row.tripId;
    this.authorId = row.authorId;
    this.body = row.body;
    this.createdAt = row.createdAt;
    this.updatedAt = row.updatedAt;
  }

  /**
   * Validate + return a normalized CreateTripCommentInput ready for
   * `CommentRepository.create()`. Throws `ValidationError` on any
   * invariant break.
   *
   *   T1 body trims to non-empty
   *   T2 trimmed body ≤ MAX_COMMENT_LENGTH
   */
  static create(input: CreateTripCommentInput): CreateTripCommentInput {
    const body = input.body.trim();
    if (body.length === 0) {
      throw new ValidationError(
        'Comment cannot be empty',
        { body: ['must be non-empty'] },
        {},
        'INVALID_COMMENT_BODY',
      );
    }
    if (body.length > MAX_COMMENT_LENGTH) {
      throw new ValidationError(
        'Comment too long',
        { body: [`must be ≤ ${MAX_COMMENT_LENGTH} chars (got ${body.length})`] },
        { length: body.length },
        'INVALID_COMMENT_BODY',
      );
    }
    return { ...input, body };
  }

  /** Wrap a persisted row in a `TripComment` instance. */
  static fromPersistence(row: TripCommentPersistenceRow): TripComment {
    return new TripComment(row);
  }
}

/** A comment joined to its author's display name, for the thread UI.
 *  Composition (not `extends TripComment`) since `TripComment` is now
 *  a class with a private constructor — interfaces can't structurally
 *  extend classes that way without breaking the `instanceof` contract. */
export interface TripCommentWithAuthor {
  readonly id: string;
  readonly tripId: string;
  readonly authorId: string;
  readonly body: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly authorDisplayName: string;
}
