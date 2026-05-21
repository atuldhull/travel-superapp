/**
 * POST.2B.1 — port for user blocks.
 *
 * `existsBetween` is symmetric: true if EITHER user blocked the
 * other. That's the gate the reaction use-cases consult.
 *
 * Installed by prompt [POST.2B.1].
 */
import type { UserBlock } from '../../domain/user-block.entity';

export interface BlockRepository {
  block(blockerId: string, blockedId: string): Promise<UserBlock>;
  unblock(blockerId: string, blockedId: string): Promise<void>;
  /** True if a blocked b OR b blocked a (symmetric gate). */
  existsBetween(a: string, b: string): Promise<boolean>;
  /** Phase 5 (J2) — every userId in a block relationship with
   *  `userId` (either direction). One query; lets a list use-case
   *  filter blocked pairs in-memory instead of N `existsBetween`
   *  round-trips. */
  listBlockedUserIds(userId: string): Promise<readonly string[]>;
}

export const BLOCK_REPOSITORY = Symbol('BlockRepository');
