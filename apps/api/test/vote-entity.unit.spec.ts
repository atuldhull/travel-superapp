/**
 * Unit tests for `Vote.create()` — pure domain test, no DB / Nest /
 * mocks. One test per invariant ([G4.1]).
 */
import { ValidationError } from '@app/errors';
import { Vote, type CreateVoteInput } from '../src/modules/social/domain/vote.entity';

const VALID: CreateVoteInput = {
  tripId: 'trip_1',
  userId: 'user_alice',
  targetType: 'itinerary_item',
  targetId: 'item_1',
  value: 1,
};

function expectInvalid(input: CreateVoteInput, code: string): void {
  try {
    Vote.create(input);
  } catch (err) {
    expect(err).toBeInstanceOf(ValidationError);
    expect((err as ValidationError).code).toBe(code);
    return;
  }
  throw new Error(`Expected Vote.create() to throw ${code}, but it succeeded`);
}

describe('Vote.create() (unit — domain invariants)', () => {
  it('happy path returns the input untouched', () => {
    expect(Vote.create(VALID)).toEqual(VALID);
  });

  it('V1 accepts each legal value (-1, 0, +1)', () => {
    expect(Vote.create({ ...VALID, value: -1 }).value).toBe(-1);
    expect(Vote.create({ ...VALID, value: 0 }).value).toBe(0);
    expect(Vote.create({ ...VALID, value: 1 }).value).toBe(1);
  });

  it('V1 rejects an out-of-range value', () => {
    expectInvalid({ ...VALID, value: 2 as unknown as 1 }, 'INVALID_VOTE_VALUE');
    expectInvalid({ ...VALID, value: -2 as unknown as -1 }, 'INVALID_VOTE_VALUE');
  });

  it('V2 accepts each legal targetType', () => {
    for (const t of ['itinerary_item', 'place', 'restaurant'] as const) {
      expect(Vote.create({ ...VALID, targetType: t }).targetType).toBe(t);
    }
  });

  it('V2 rejects an unknown targetType', () => {
    expectInvalid({ ...VALID, targetType: 'unknown' as 'place' }, 'INVALID_VOTE_TARGET');
  });

  it('V3 rejects empty tripId / userId / targetId', () => {
    expectInvalid({ ...VALID, tripId: '' }, 'INVALID_VOTE_TARGET');
    expectInvalid({ ...VALID, userId: '' }, 'INVALID_VOTE_TARGET');
    expectInvalid({ ...VALID, targetId: '' }, 'INVALID_VOTE_TARGET');
  });
});

describe('Vote.fromPersistence() (unit)', () => {
  it('round-trips a DB row into a class instance', () => {
    const vote = Vote.fromPersistence({
      id: 'vote_1',
      tripId: 'trip_1',
      userId: 'user_alice',
      targetType: 'itinerary_item',
      targetId: 'item_1',
      value: 1,
      createdAt: new Date('2026-05-24T00:00:00Z'),
    });
    expect(vote).toBeInstanceOf(Vote);
    expect(vote.value).toBe(1);
  });
});
