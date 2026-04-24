/**
 * Plain-data `Vote` domain entity. Mirrors the Prisma `Vote` row
 * that's been in the schema since day one. Generic by design —
 * `targetType` + `targetId` lets a single table serve itinerary
 * items today and places / restaurants / stays in follow-up
 * slices without a schema change.
 *
 * `value` is -1 / 0 / +1 (thumbs-down / meh / thumbs-up). The
 * `0` row exists so a user can revoke a prior vote without
 * deleting the row — though v1's API uses DELETE for revoke,
 * so `0` is dormant today. Kept on the domain type for forward
 * compat with sum/average queries.
 *
 * Installed by prompt [IV.18.12.3].
 */
export type VoteTargetType = 'itinerary_item' | 'place' | 'restaurant';

export type VoteValue = -1 | 0 | 1;

export interface Vote {
  readonly id: string;
  readonly tripId: string;
  readonly userId: string;
  readonly targetType: VoteTargetType;
  readonly targetId: string;
  readonly value: VoteValue;
  readonly createdAt: Date;
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
