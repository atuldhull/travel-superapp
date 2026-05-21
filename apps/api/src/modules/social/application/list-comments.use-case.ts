/**
 * Phase 5 (J4) — list the comment thread for a published trip.
 *
 * Returns `[]` (not an error) when the trip isn't commentable — a
 * never-published or unpublished trip simply has no public thread,
 * and an empty list is the honest answer that doesn't probe
 * existence. Comments authored by a user in a block relationship
 * with the viewer are filtered out (same posture as the feed).
 *
 * Installed by prompt [J4].
 */
import { Inject, Injectable } from '@nestjs/common';
import type { TripCommentWithAuthor } from '../domain/trip-comment.entity';
import { COMMENT_REPOSITORY, type CommentRepository } from './ports/comment.repository';
import { BLOCK_REPOSITORY, type BlockRepository } from './ports/block.repository';

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;

export interface ListCommentsQuery {
  readonly tripId: string;
  readonly viewerId: string;
  readonly limit?: number;
}

@Injectable()
export class ListCommentsUseCase {
  constructor(
    @Inject(COMMENT_REPOSITORY) private readonly comments: CommentRepository,
    @Inject(BLOCK_REPOSITORY) private readonly blocks: BlockRepository,
  ) {}

  async execute(query: ListCommentsQuery): Promise<readonly TripCommentWithAuthor[]> {
    const commentable = await this.comments.findCommentableTrip(query.tripId);
    if (!commentable) return [];

    const limit = clampLimit(query.limit);
    const raw = await this.comments.listForTrip(query.tripId, limit + MAX_LIMIT);
    const blocked = new Set(await this.blocks.listBlockedUserIds(query.viewerId));
    return raw.filter((c) => !blocked.has(c.authorId)).slice(0, limit);
  }
}

function clampLimit(raw: number | undefined): number {
  if (raw === undefined || !Number.isFinite(raw)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, Math.trunc(raw)));
}
