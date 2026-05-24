/**
 * `Vote` domain entity. Generic ±1/0 vote — `targetType` + `targetId`
 * lets a single table serve itinerary items today and places /
 * restaurants / stays in follow-up slices without a schema change.
 *
 * DDD refactor by [G4.1]: `value` and `targetType` used to be guarded
 * only by the controller DTO + TypeScript narrowing. The entity now
 * also runtime-checks the discriminants on `Vote.create()` so adapter-
 * level upserts can't accept a malformed value via a raw call.
 *
 *   V1 value ∈ {-1, 0, +1}
 *   V2 targetType ∈ {itinerary_item, place, restaurant}
 *   V3 tripId, userId, targetId are non-empty strings
 *
 * `value` is -1 / 0 / +1 (thumbs-down / meh / thumbs-up). The
 * `0` row exists so a user can revoke a prior vote without
 * deleting the row — though v1's API uses DELETE for revoke,
 * so `0` is dormant today.
 *
 * Installed by prompt [IV.18.12.3]; entity-ized by [G4.1].
 */
import { ValidationError } from '@app/errors';

export type VoteTargetType = 'itinerary_item' | 'place' | 'restaurant';
export const VOTE_TARGET_TYPES: readonly VoteTargetType[] = [
  'itinerary_item',
  'place',
  'restaurant',
];

export type VoteValue = -1 | 0 | 1;
export const VOTE_VALUES: readonly VoteValue[] = [-1, 0, 1];

/** Input shape for `Vote.create()` — the upsert payload BEFORE the
 *  DB assigns id + timestamps. */
export interface CreateVoteInput {
  readonly tripId: string;
  readonly userId: string;
  readonly targetType: VoteTargetType;
  readonly targetId: string;
  readonly value: VoteValue;
}

/** Row shape returned by the Prisma adapter. */
export interface VotePersistenceRow {
  readonly id: string;
  readonly tripId: string;
  readonly userId: string;
  readonly targetType: VoteTargetType;
  readonly targetId: string;
  readonly value: VoteValue;
  readonly createdAt: Date;
}

export class Vote {
  readonly id: string;
  readonly tripId: string;
  readonly userId: string;
  readonly targetType: VoteTargetType;
  readonly targetId: string;
  readonly value: VoteValue;
  readonly createdAt: Date;

  private constructor(row: VotePersistenceRow) {
    this.id = row.id;
    this.tripId = row.tripId;
    this.userId = row.userId;
    this.targetType = row.targetType;
    this.targetId = row.targetId;
    this.value = row.value;
    this.createdAt = row.createdAt;
  }

  /**
   * Validate + return the CreateVoteInput ready for
   * `VoteRepository.upsert()`. Throws `ValidationError` on any
   * invariant break (V1/V2/V3).
   */
  static create(input: CreateVoteInput): CreateVoteInput {
    if (typeof input.tripId !== 'string' || input.tripId.length === 0) {
      throw new ValidationError(
        'tripId must be a non-empty string',
        { tripId: ['must be non-empty'] },
        {},
        'INVALID_VOTE_TARGET',
      );
    }
    if (typeof input.userId !== 'string' || input.userId.length === 0) {
      throw new ValidationError(
        'userId must be a non-empty string',
        { userId: ['must be non-empty'] },
        {},
        'INVALID_VOTE_TARGET',
      );
    }
    if (typeof input.targetId !== 'string' || input.targetId.length === 0) {
      throw new ValidationError(
        'targetId must be a non-empty string',
        { targetId: ['must be non-empty'] },
        {},
        'INVALID_VOTE_TARGET',
      );
    }
    if (!VOTE_TARGET_TYPES.includes(input.targetType)) {
      throw new ValidationError(
        `targetType must be one of ${VOTE_TARGET_TYPES.join(' | ')}`,
        { targetType: [`unknown: ${input.targetType}`] },
        { targetType: input.targetType },
        'INVALID_VOTE_TARGET',
      );
    }
    if (!VOTE_VALUES.includes(input.value)) {
      throw new ValidationError(
        'value must be -1, 0, or +1',
        { value: [`unknown: ${input.value}`] },
        { value: input.value },
        'INVALID_VOTE_VALUE',
      );
    }
    return input;
  }

  /** Wrap a persisted row in a `Vote` instance. */
  static fromPersistence(row: VotePersistenceRow): Vote {
    return new Vote(row);
  }
}

/**
 * Aggregate count of vote values for a single target — what the
 * `GET /trips/:tripId/votes` response renders. No per-user
 * breakdown by default (privacy + response-size); the authed
 * caller's own vote is surfaced separately as `mine`.
 */
export interface VoteTally {
  readonly targetType: VoteTargetType;
  readonly targetId: string;
  readonly up: number;
  readonly meh: number;
  readonly down: number;
  /** Sum: (+1×up) + (0×meh) + (-1×down). Convenient rank signal. */
  readonly score: number;
  /** The authed caller's own vote on this target, or `null`. */
  readonly mine: VoteValue | null;
}
