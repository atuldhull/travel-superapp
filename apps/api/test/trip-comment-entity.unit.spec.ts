/**
 * Unit tests for `TripComment.create()` — pure domain test, no DB /
 * Nest / mocks. One test per invariant ([G4.1]).
 */
import { ValidationError } from '@app/errors';
import {
  TripComment,
  MAX_COMMENT_LENGTH,
  type CreateTripCommentInput,
} from '../src/modules/social/domain/trip-comment.entity';

const VALID: CreateTripCommentInput = {
  tripId: 'trip_1',
  authorId: 'user_alice',
  body: 'looks great!',
};

function expectInvalid(input: CreateTripCommentInput, code: string): void {
  try {
    TripComment.create(input);
  } catch (err) {
    expect(err).toBeInstanceOf(ValidationError);
    expect((err as ValidationError).code).toBe(code);
    return;
  }
  throw new Error(`Expected TripComment.create() to throw ${code}, but it succeeded`);
}

describe('TripComment.create() (unit — domain invariants)', () => {
  it('happy path returns the input with body trimmed', () => {
    const out = TripComment.create({ ...VALID, body: '   hi   ' });
    expect(out).toEqual({ ...VALID, body: 'hi' });
  });

  it('T1 rejects an empty body (after trim)', () => {
    expectInvalid({ ...VALID, body: '' }, 'INVALID_COMMENT_BODY');
    expectInvalid({ ...VALID, body: '   ' }, 'INVALID_COMMENT_BODY');
  });

  it(`T2 rejects a body longer than ${MAX_COMMENT_LENGTH} chars`, () => {
    expectInvalid({ ...VALID, body: 'x'.repeat(MAX_COMMENT_LENGTH + 1) }, 'INVALID_COMMENT_BODY');
  });
});

describe('TripComment.fromPersistence() (unit)', () => {
  it('round-trips a DB row into a class instance', () => {
    const comment = TripComment.fromPersistence({
      id: 'tc_1',
      tripId: 'trip_1',
      authorId: 'user_alice',
      body: 'looks great!',
      createdAt: new Date('2026-05-24T00:00:00Z'),
      updatedAt: new Date('2026-05-24T00:00:00Z'),
    });
    expect(comment).toBeInstanceOf(TripComment);
    expect(comment.body).toBe('looks great!');
  });
});
