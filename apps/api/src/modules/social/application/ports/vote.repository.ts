/**
 * Port for Vote persistence. Shape is narrow + CRUD-flavored —
 * the business rules (who can vote where) live in the use-case
 * layer, not here.
 *
 *   - `upsert` — new vote or change an existing one. The UNIQUE
 *                 `(tripId, userId, targetType, targetId)` index
 *                 enforces "one vote per user per target".
 *   - `deleteForUser` — remove a specific user's vote on one
 *                       target. Idempotent: returns `false` if
 *                       no row existed (caller maps to 404).
 *   - `listForTrip` — every vote on the trip across all targets +
 *                     users. The use-case aggregates into
 *                     `VoteTally[]` for the HTTP response.
 *   - `findForUser` — a single user's vote on a single target
 *                     (used to populate the `mine` field on
 *                     tallies).
 *
 * Installed by prompt [IV.18.12.3].
 */
import type { Vote, VoteTargetType, VoteValue } from '../../domain/vote.entity';

export interface UpsertVoteInput {
  readonly tripId: string;
  readonly userId: string;
  readonly targetType: VoteTargetType;
  readonly targetId: string;
  readonly value: VoteValue;
}

export interface DeleteVoteInput {
  readonly tripId: string;
  readonly userId: string;
  readonly targetType: VoteTargetType;
  readonly targetId: string;
}

export interface FindVoteInput {
  readonly tripId: string;
  readonly userId: string;
  readonly targetType: VoteTargetType;
  readonly targetId: string;
}

export interface VoteRepository {
  upsert(input: UpsertVoteInput): Promise<Vote>;
  /** Returns `true` iff a row was actually deleted. */
  deleteForUser(input: DeleteVoteInput): Promise<boolean>;
  listForTrip(tripId: string): Promise<readonly Vote[]>;
  findForUser(input: FindVoteInput): Promise<Vote | null>;
}

export const VOTE_REPOSITORY = Symbol('VoteRepository');
