/**
 * V.UX.25 — port for the reviewer-karma surface. v1 shape:
 *
 *   - Compute the inputs (reviewCount + helpfulVotesReceived) from
 *     existing rows + upsert the karma row in one call (`recomputeForUser`).
 *   - Read by userId for the public profile.
 *   - Insert + dedup helpful votes (`HelpfulVoteRepository`).
 *
 * Adapters live in `infrastructure/`.
 *
 * Installed by prompt [V.UX.25].
 */
import type { UserKarma } from '../../domain/karma.entity';

export interface RecomputeKarmaResult {
  readonly userId: string;
  readonly karma: UserKarma;
  /** True iff the recompute changed at least one of the denormalised
   *  counters or the badges array. False = no-op write. */
  readonly changed: boolean;
}

export interface KarmaRepository {
  /**
   * Recompute the karma row for `userId` from current Review +
   * HelpfulVote totals. Upserts (creates the row on first call).
   * Returns the resulting row + a `changed` flag the caller / scheduler
   * can use for "X users updated this tick" telemetry.
   *
   * Pure: no side effects beyond the upsert. Idempotent.
   */
  recomputeForUser(userId: string): Promise<RecomputeKarmaResult>;

  findByUserId(userId: string): Promise<UserKarma | null>;

  /**
   * Snapshot of every userId that has at least one review OR one
   * helpful vote received. Used by the nightly scheduler to walk
   * the active set without scanning every User row.
   */
  listActiveReviewerUserIds(): Promise<readonly string[]>;
}

export const KARMA_REPOSITORY = Symbol('KarmaRepository');
