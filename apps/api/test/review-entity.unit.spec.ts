/**
 * Unit tests for `Review.create()` — pure domain test, no DB / Nest /
 * mocks. One test per invariant ([G4.1]).
 */
import { ValidationError } from '@app/errors';
import {
  Review,
  REVIEW_MAX_BODY_LENGTH,
  type CreateReviewInput,
} from '../src/modules/social/domain/review.entity';

const VALID: CreateReviewInput = {
  authorId: 'user_alice',
  tripId: 'trip_1',
  targetType: 'place',
  targetId: 'place_eiffel',
  rating: 5,
  body: 'Magnifique.',
  language: 'fr',
};

function expectInvalid(input: CreateReviewInput, code: string): void {
  try {
    Review.create(input);
  } catch (err) {
    expect(err).toBeInstanceOf(ValidationError);
    expect((err as ValidationError).code).toBe(code);
    return;
  }
  throw new Error(`Expected Review.create() to throw ${code}, but it succeeded`);
}

describe('Review.create() (unit — domain invariants)', () => {
  it('happy path returns the input, body trimmed + language lowercased', () => {
    const out = Review.create({ ...VALID, body: '  ok!  ', language: 'EN' });
    expect(out).toEqual({ ...VALID, body: 'ok!', language: 'en' });
  });

  it('R1 rejects a rating outside [1,5] or non-integer', () => {
    expectInvalid({ ...VALID, rating: 0 }, 'INVALID_RATING');
    expectInvalid({ ...VALID, rating: 6 }, 'INVALID_RATING');
    expectInvalid({ ...VALID, rating: 3.5 }, 'INVALID_RATING');
    expectInvalid({ ...VALID, rating: Number.NaN }, 'INVALID_RATING');
  });

  it('R2 rejects an empty body (after trim)', () => {
    expectInvalid({ ...VALID, body: '' }, 'INVALID_REVIEW_BODY');
    expectInvalid({ ...VALID, body: '   ' }, 'INVALID_REVIEW_BODY');
  });

  it(`R2 rejects a body longer than ${REVIEW_MAX_BODY_LENGTH} chars`, () => {
    expectInvalid(
      { ...VALID, body: 'x'.repeat(REVIEW_MAX_BODY_LENGTH + 1) },
      'INVALID_REVIEW_BODY',
    );
  });

  it('R3 rejects a language that is not 2 lowercase letters', () => {
    expectInvalid({ ...VALID, language: 'e' }, 'INVALID_LANGUAGE');
    expectInvalid({ ...VALID, language: 'eng' }, 'INVALID_LANGUAGE');
    expectInvalid({ ...VALID, language: '12' }, 'INVALID_LANGUAGE');
  });

  it('accepts a standalone (tripId null) review', () => {
    const out = Review.create({ ...VALID, tripId: null });
    expect(out.tripId).toBeNull();
  });
});

describe('Review.fromPersistence() (unit)', () => {
  it('round-trips a DB row into a class instance', () => {
    const row = {
      id: 'rev_1',
      authorId: 'user_alice',
      tripId: null,
      targetType: 'place' as const,
      targetId: 'place_eiffel',
      rating: 5,
      body: 'Magnifique.',
      language: 'fr',
      verifiedBooking: false,
      responseBody: null,
      responseAt: null,
      createdAt: new Date('2026-05-24T00:00:00Z'),
      updatedAt: new Date('2026-05-24T00:00:00Z'),
    };
    const review = Review.fromPersistence(row);
    expect(review).toBeInstanceOf(Review);
    expect(review.id).toBe('rev_1');
    expect(review.rating).toBe(5);
    expect(review.verifiedBooking).toBe(false);
  });
});
