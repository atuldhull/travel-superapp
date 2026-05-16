/**
 * POST.2B.1 — port for the follow graph.
 *
 * `follow`/`unfollow` are idempotent (the composite PK makes a
 * double-follow a no-op; unfollow of a non-edge is a no-op).
 *
 * Installed by prompt [POST.2B.1].
 */
import type { Follow } from '../../domain/follow.entity';

export interface FollowRepository {
  follow(followerId: string, followeeId: string): Promise<Follow>;
  unfollow(followerId: string, followeeId: string): Promise<void>;
  exists(followerId: string, followeeId: string): Promise<boolean>;
  countFollowers(followeeId: string): Promise<number>;
}

export const FOLLOW_REPOSITORY = Symbol('FollowRepository');
