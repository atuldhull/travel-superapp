/**
 * Property-based tests for `Vote.create()` ([I2]).
 *
 * Vote's invariants are short discriminant checks (value ∈ {-1, 0, 1},
 * targetType ∈ enum, non-empty ids) so the property-based payoff is
 * mostly negative-space coverage: random ints / unknown strings get
 * rejected exhaustively rather than via cherry-picked examples.
 */
import fc from 'fast-check';
import { ValidationError } from '@app/errors';
import {
  Vote,
  VOTE_TARGET_TYPES,
  VOTE_VALUES,
  type CreateVoteInput,
  type VoteTargetType,
  type VoteValue,
} from '../src/modules/social/domain/vote.entity';

const validVote: fc.Arbitrary<CreateVoteInput> = fc.record({
  tripId: fc
    .string({ minLength: 4, maxLength: 24, unit: 'grapheme-ascii' })
    .filter((s) => s.length > 0),
  userId: fc
    .string({ minLength: 4, maxLength: 24, unit: 'grapheme-ascii' })
    .filter((s) => s.length > 0),
  targetType: fc.constantFrom(...VOTE_TARGET_TYPES) as fc.Arbitrary<VoteTargetType>,
  targetId: fc
    .string({ minLength: 4, maxLength: 24, unit: 'grapheme-ascii' })
    .filter((s) => s.length > 0),
  value: fc.constantFrom(...VOTE_VALUES) as fc.Arbitrary<VoteValue>,
});

describe('Vote.create (property-based)', () => {
  it('P1: accepts every input with legal discriminants', () => {
    fc.assert(
      fc.property(validVote, (input) => {
        expect(Vote.create(input)).toEqual(input);
      }),
    );
  });

  it('V1: any value outside {-1, 0, +1} → INVALID_VOTE_VALUE', () => {
    const bad = fc.integer().filter((n) => n !== -1 && n !== 0 && n !== 1);
    fc.assert(
      fc.property(validVote, bad, (input, value) => {
        try {
          Vote.create({ ...input, value: value as VoteValue });
          throw new Error('expected throw');
        } catch (err) {
          expect(err).toBeInstanceOf(ValidationError);
          expect((err as ValidationError).code).toBe('INVALID_VOTE_VALUE');
        }
      }),
    );
  });

  it('V2: any unknown targetType string → INVALID_VOTE_TARGET', () => {
    const bad = fc
      .string({ minLength: 1, maxLength: 24, unit: 'grapheme-ascii' })
      .filter((s) => !VOTE_TARGET_TYPES.includes(s as VoteTargetType));
    fc.assert(
      fc.property(validVote, bad, (input, targetType) => {
        try {
          Vote.create({ ...input, targetType: targetType as VoteTargetType });
          throw new Error('expected throw');
        } catch (err) {
          expect(err).toBeInstanceOf(ValidationError);
          expect((err as ValidationError).code).toBe('INVALID_VOTE_TARGET');
        }
      }),
    );
  });

  it('V3: empty tripId / userId / targetId → INVALID_VOTE_TARGET', () => {
    const which = fc.constantFrom<'tripId' | 'userId' | 'targetId'>('tripId', 'userId', 'targetId');
    fc.assert(
      fc.property(validVote, which, (input, field) => {
        try {
          Vote.create({ ...input, [field]: '' });
          throw new Error('expected throw');
        } catch (err) {
          expect(err).toBeInstanceOf(ValidationError);
          expect((err as ValidationError).code).toBe('INVALID_VOTE_TARGET');
        }
      }),
    );
  });
});
