/**
 * Property-based tests for `Review.create()` ([I2]).
 */
import fc from 'fast-check';
import { ValidationError } from '@app/errors';
import {
  Review,
  REVIEW_MAX_BODY_LENGTH,
  REVIEW_MAX_RATING,
  REVIEW_MIN_RATING,
  type CreateReviewInput,
  type ReviewTargetType,
} from '../src/modules/social/domain/review.entity';

const targetType: fc.Arbitrary<ReviewTargetType> = fc.constantFrom(
  'place',
  'stay',
  'eatery',
  'agent',
);

const language = fc
  .string({ minLength: 2, maxLength: 2, unit: 'grapheme-ascii' })
  .filter((s) => /^[a-zA-Z]{2}$/.test(s));

const validReview: fc.Arbitrary<CreateReviewInput> = fc.record({
  authorId: fc
    .string({ minLength: 6, maxLength: 32, unit: 'grapheme-ascii' })
    .filter((s) => s.trim().length > 0),
  tripId: fc.option(
    fc
      .string({ minLength: 6, maxLength: 32, unit: 'grapheme-ascii' })
      .filter((s) => s.trim().length > 0),
    { nil: null },
  ),
  targetType,
  targetId: fc
    .string({ minLength: 4, maxLength: 32, unit: 'grapheme-ascii' })
    .filter((s) => s.trim().length > 0),
  rating: fc.integer({ min: REVIEW_MIN_RATING, max: REVIEW_MAX_RATING }),
  body: fc
    .string({ minLength: 1, maxLength: REVIEW_MAX_BODY_LENGTH })
    .filter((s) => s.trim().length > 0),
  language,
});

describe('Review.create (property-based)', () => {
  it('R1: integer ratings outside [1,5] → INVALID_RATING', () => {
    const badRating = fc.oneof(
      fc.integer({ max: REVIEW_MIN_RATING - 1 }),
      fc.integer({ min: REVIEW_MAX_RATING + 1 }),
    );
    fc.assert(
      fc.property(validReview, badRating, (input, rating) => {
        try {
          Review.create({ ...input, rating });
          throw new Error('expected throw');
        } catch (err) {
          expect(err).toBeInstanceOf(ValidationError);
          expect((err as ValidationError).code).toBe('INVALID_RATING');
        }
      }),
    );
  });

  it('R1: non-integer ratings → INVALID_RATING', () => {
    const fractionalRating = fc
      .double({ min: 1.01, max: 4.99, noNaN: true })
      .filter((d) => !Number.isInteger(d));
    fc.assert(
      fc.property(validReview, fractionalRating, (input, rating) => {
        try {
          Review.create({ ...input, rating });
          throw new Error('expected throw');
        } catch (err) {
          expect(err).toBeInstanceOf(ValidationError);
          expect((err as ValidationError).code).toBe('INVALID_RATING');
        }
      }),
    );
  });

  it(`R2: any body longer than ${REVIEW_MAX_BODY_LENGTH} chars → INVALID_REVIEW_BODY`, () => {
    fc.assert(
      fc.property(
        validReview,
        fc.integer({ min: REVIEW_MAX_BODY_LENGTH + 1, max: REVIEW_MAX_BODY_LENGTH + 50 }),
        (input, len) => {
          try {
            Review.create({ ...input, body: 'x'.repeat(len) });
            throw new Error('expected throw');
          } catch (err) {
            expect(err).toBeInstanceOf(ValidationError);
            expect((err as ValidationError).code).toBe('INVALID_REVIEW_BODY');
          }
        },
      ),
    );
  });

  it('R3: any non-2-letter language → INVALID_LANGUAGE', () => {
    const badLang = fc.oneof(
      fc.string({ minLength: 1, maxLength: 1, unit: 'grapheme-ascii' }),
      fc.string({ minLength: 3, maxLength: 8, unit: 'grapheme-ascii' }),
      fc.constantFrom('1a', '12', '!@'),
    );
    fc.assert(
      fc.property(validReview, badLang, (input, lang) => {
        try {
          Review.create({ ...input, language: lang });
          throw new Error('expected throw');
        } catch (err) {
          expect(err).toBeInstanceOf(ValidationError);
          expect((err as ValidationError).code).toBe('INVALID_LANGUAGE');
        }
      }),
    );
  });

  it('P+: language is lowercased on the output (round-trip)', () => {
    fc.assert(
      fc.property(validReview, (input) => {
        const out = Review.create(input);
        expect(out.language).toBe(input.language.toLowerCase());
      }),
    );
  });
});
