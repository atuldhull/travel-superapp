/**
 * POST.2B.1 — port for the follow graph.
 *
 * `follow`/`unfollow` are idempotent (the composite PK makes a
 * double-follow a no-op; unfollow of a non-edge is a no-op).
 *
 * Installed by prompt [POST.2B.1].
 */
import type { Follow } from '../../domain/follow.entity';

/**
 * Phase 5 (J2) — one user on a follower/following list, joined to
 * `User` for the display name. The `Follow` model is FK-less (the
 * admin-audit precedent), so the adapter resolves names with a
 * second `user.findMany` rather than a relation `include`.
 */
export interface FollowEdgeUser {
  readonly userId: string;
  readonly displayName: string;
  readonly followedAt: Date;
}

export interface FollowRepository {
  follow(followerId: string, followeeId: string): Promise<Follow>;
  unfollow(followerId: string, followeeId: string): Promise<void>;
  exists(followerId: string, followeeId: string): Promise<boolean>;
  countFollowers(followeeId: string): Promise<number>;
  /** Phase 5 (J2) — users who follow `followeeId`, newest edge first,
   *  capped at `limit`. Soft-deleted users are dropped. */
  listFollowers(followeeId: string, limit: number): Promise<readonly FollowEdgeUser[]>;
  /** Phase 5 (J2) — users `followerId` follows, newest edge first. */
  listFollowing(followerId: string, limit: number): Promise<readonly FollowEdgeUser[]>;
  /** Phase 5 (J2) — how many users `followerId` follows. */
  countFollowing(followerId: string): Promise<number>;
}

export const FOLLOW_REPOSITORY = Symbol('FollowRepository');
