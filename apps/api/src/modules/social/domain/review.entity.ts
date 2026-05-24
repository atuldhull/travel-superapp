/**
 * `Review` domain entity. Standalone OR trip-attached review of a
 * place / stay / eatery / agent.
 *
 * DDD refactor by [G4.1]: the 3 invariants that used to live inline
 * in `CreateReviewUseCase.validate()` (R1 rating-1..5-int,
 * R2 body-non-empty-≤5000-chars-after-trim, R3 language-ISO-639-1)
 * have moved onto the entity itself behind `Review.create(input)`.
 * The use-case becomes: gate (trip access + block) → `Review.create()`
 * → `repo.create()`.
 *
 * Persistence reconstruction goes through `Review.fromPersistence()` —
 * the repo adapter wraps Prisma rows in this static so the toDomain()
 * cast surface lives on the entity, not in infra.
 *
 * `tripId` is optional — reviews can be standalone (write a
 * review of a place you visited solo, no trip needed) or
 * trip-attached (so the trip's collaborators can read + the
 * author's "I went here on my Paris trip" context shows up).
 *
 * `targetType` is an enum: place | stay | eatery | agent.
 *
 * Unlike Vote (unique per user+target), Review has NO unique
 * constraint — a user can leave multiple reviews on the same
 * target from different trips over time.
 *
 * Installed by prompt [IV.18.12.5]; entity-ized by [G4.1].
 */
import { ValidationError } from '@app/errors';

export type ReviewTargetType = 'place' | 'stay' | 'eatery' | 'agent';

/** Validation rule limits (also the values asserted by the unit
 *  test). Exported so the use-case error messages can quote them
 *  without duplicating magic numbers. */
export const REVIEW_MIN_RATING = 1;
export const REVIEW_MAX_RATING = 5;
export const REVIEW_MAX_BODY_LENGTH = 5000;
const LANGUAGE_REGEX = /^[a-z]{2}$/;

/** Input shape for `Review.create()` — the new-review payload BEFORE
 *  the DB assigns id + timestamps. Mirrors `CreateReviewInput` on the
 *  port (kept in lockstep). */
export interface CreateReviewInput {
  readonly authorId: string;
  readonly tripId: string | null;
  readonly targetType: ReviewTargetType;
  readonly targetId: string;
  readonly rating: number;
  readonly body: string;
  readonly language: string;
}

/** Row shape returned by the Prisma adapter — id, timestamps, and the
 *  optional V.UX.24 response columns all filled in by the DB. */
export interface ReviewPersistenceRow {
  readonly id: string;
  readonly authorId: string;
  readonly tripId: string | null;
  readonly targetType: ReviewTargetType;
  readonly targetId: string;
  readonly rating: number;
  readonly body: string;
  readonly language: string;
  readonly verifiedBooking: boolean;
  readonly responseBody: string | null;
  readonly responseAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export class Review {
  readonly id: string;
  readonly authorId: string;
  readonly tripId: string | null;
  readonly targetType: ReviewTargetType;
  readonly targetId: string;
  readonly rating: number;
  readonly body: string;
  readonly language: string;
  readonly verifiedBooking: boolean;
  /**
   * V.UX.24 — target-owner reply (e.g. an agent replying to a
   * review about themselves). Stamped at most once; the use-case
   * rejects re-submissions. Null until the owner responds.
   */
  readonly responseBody: string | null;
  readonly responseAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(row: ReviewPersistenceRow) {
    this.id = row.id;
    this.authorId = row.authorId;
    this.tripId = row.tripId;
    this.targetType = row.targetType;
    this.targetId = row.targetId;
    this.rating = row.rating;
    this.body = row.body;
    this.language = row.language;
    this.verifiedBooking = row.verifiedBooking;
    this.responseBody = row.responseBody;
    this.responseAt = row.responseAt;
    this.createdAt = row.createdAt;
    this.updatedAt = row.updatedAt;
  }

  /**
   * Validate + return a normalized CreateReviewInput ready for
   * `ReviewRepository.create()`. Throws `ValidationError` on any
   * invariant break.
   *
   *   R1 rating is an integer in [1, 5]
   *   R2 body is non-empty + ≤ 5000 chars (after trim)
   *   R3 language is exactly 2 lowercase ISO-639-1 letters
   *
   * Normalises: body.trim(), language.toLowerCase().
   */
  static create(input: CreateReviewInput): CreateReviewInput {
    if (
      !Number.isInteger(input.rating) ||
      input.rating < REVIEW_MIN_RATING ||
      input.rating > REVIEW_MAX_RATING
    ) {
      throw new ValidationError(
        `Rating must be an integer between ${REVIEW_MIN_RATING} and ${REVIEW_MAX_RATING}`,
        { rating: [`must be integer in [${REVIEW_MIN_RATING}, ${REVIEW_MAX_RATING}]`] },
        { rating: input.rating },
        'INVALID_RATING',
      );
    }
    const body = input.body.trim();
    if (body.length === 0) {
      throw new ValidationError(
        'Review body cannot be empty',
        { body: ['must be non-empty'] },
        {},
        'INVALID_REVIEW_BODY',
      );
    }
    if (body.length > REVIEW_MAX_BODY_LENGTH) {
      throw new ValidationError(
        'Review body too long',
        { body: [`must be ≤ ${REVIEW_MAX_BODY_LENGTH} chars (got ${body.length})`] },
        { length: body.length },
        'INVALID_REVIEW_BODY',
      );
    }
    const language = input.language.toLowerCase();
    if (!LANGUAGE_REGEX.test(language)) {
      throw new ValidationError(
        'Language must be a 2-letter ISO 639-1 code',
        { language: ['must be 2 lowercase letters'] },
        { language: input.language },
        'INVALID_LANGUAGE',
      );
    }
    return { ...input, body, language };
  }

  /** Wrap a persisted row in a `Review` instance. DB rows are by
   *  construction already valid; no re-validation runs here. */
  static fromPersistence(row: ReviewPersistenceRow): Review {
    return new Review(row);
  }
}
