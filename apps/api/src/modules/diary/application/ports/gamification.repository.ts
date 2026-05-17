/**
 * Persistence port for the gamification profile + earned-badge
 * ledger. `applyAward` is one atomic DB unit (upsert profile +
 * idempotent badge inserts) — pure DB, no network, so it MAY use a
 * prisma transaction (CLAUDE.md #13 only forbids network in a txn).
 *
 * Installed for the adventure-diary feature.
 */
import type { GamificationState } from '../../domain/gamification';

export interface GamificationSnapshot extends GamificationState {
  readonly earnedBadgeKeys: readonly string[];
}

export interface ApplyAwardInput {
  readonly userId: string;
  readonly next: GamificationState;
  readonly newlyEarnedBadges: readonly string[];
}

export interface GamificationRepository {
  /** Profile + earned badges. Never null — absent = the empty state. */
  snapshot(userId: string): Promise<GamificationSnapshot>;
  /** Upsert the running totals + append any newly-earned badges. */
  applyAward(input: ApplyAwardInput): Promise<void>;
}

export const GAMIFICATION_REPOSITORY = Symbol('GamificationRepository');
