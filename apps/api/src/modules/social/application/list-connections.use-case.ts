/**
 * Phase 5 (J2) — list a user's follower / following connections.
 *
 * One use-case, two directions (`kind`): `followers` = users who
 * follow the target; `following` = users the target follows. The
 * follow graph + counts shipped in POST.2B.1 but were invisible —
 * this read seam is what the new web connections pages render.
 *
 * Block-aware: any user in a block relationship with the VIEWER
 * (either direction) is filtered out, consistent with how the feed
 * hides blocked pairs. The filter is one query (`listBlockedUserIds`)
 * + an in-memory pass — no N+1.
 *
 * Honest scope: an unknown `userId` simply yields an empty list (no
 * existence probe — the public-profile endpoint already owns the
 * "does this user exist" 404).
 *
 * Installed by prompt [J2].
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  FOLLOW_REPOSITORY,
  type FollowEdgeUser,
  type FollowRepository,
} from './ports/follow.repository';
import { BLOCK_REPOSITORY, type BlockRepository } from './ports/block.repository';

export type ConnectionKind = 'followers' | 'following';

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;

export interface ListConnectionsQuery {
  readonly userId: string;
  readonly viewerId: string;
  readonly kind: ConnectionKind;
  readonly limit?: number;
}

export interface ListConnectionsResult {
  readonly users: readonly FollowEdgeUser[];
}

@Injectable()
export class ListConnectionsUseCase {
  constructor(
    @Inject(FOLLOW_REPOSITORY) private readonly follows: FollowRepository,
    @Inject(BLOCK_REPOSITORY) private readonly blocks: BlockRepository,
  ) {}

  async execute(query: ListConnectionsQuery): Promise<ListConnectionsResult> {
    const limit = clampLimit(query.limit);
    // Over-fetch a little so the block filter can't shrink the page
    // below what the caller asked for in the common (few-blocks) case.
    const raw =
      query.kind === 'followers'
        ? await this.follows.listFollowers(query.userId, limit + MAX_LIMIT)
        : await this.follows.listFollowing(query.userId, limit + MAX_LIMIT);

    const blocked = new Set(await this.blocks.listBlockedUserIds(query.viewerId));
    const visible = raw.filter((u) => !blocked.has(u.userId)).slice(0, limit);
    return { users: visible };
  }
}

function clampLimit(raw: number | undefined): number {
  if (raw === undefined || !Number.isFinite(raw)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, Math.trunc(raw)));
}
