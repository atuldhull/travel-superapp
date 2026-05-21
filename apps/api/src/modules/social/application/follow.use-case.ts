/**
 * POST.2B.1 — follow a user.
 *
 * Self-follow is rejected by the domain (422). A block in either
 * direction refuses the follow (403, via the shared gate).
 * Idempotent: a repeat follow is a no-op (composite PK).
 *
 * Installed by prompt [POST.2B.1].
 */
import { Inject, Injectable } from '@nestjs/common';
import { EVENT_BUS, type EventBus } from '@app/events';
import { ValidationError } from '@app/errors';
import { getTraceContext } from '@app/logger';
import type { Follow } from '../domain/follow.entity';
import { makeEvent, type UserFollowedEvent } from '../domain/social.events';
import { FOLLOW_REPOSITORY, type FollowRepository } from './ports/follow.repository';
import { BLOCK_REPOSITORY, type BlockRepository } from './ports/block.repository';
import { assertNotBlocked } from './block-user.use-case';

export interface FollowCommand {
  readonly followerId: string;
  readonly followeeId: string;
}

@Injectable()
export class FollowUseCase {
  constructor(
    @Inject(FOLLOW_REPOSITORY) private readonly follows: FollowRepository,
    @Inject(BLOCK_REPOSITORY) private readonly blocks: BlockRepository,
    @Inject(EVENT_BUS) private readonly events: EventBus,
  ) {}

  async execute(cmd: FollowCommand): Promise<Follow> {
    if (cmd.followerId === cmd.followeeId) {
      throw new ValidationError(
        'Cannot follow yourself',
        { followeeId: ['cannot be self'] },
        {},
        'CANNOT_FOLLOW_SELF',
      );
    }
    await assertNotBlocked(this.blocks, cmd.followerId, cmd.followeeId);

    // J6 — only a NEW edge is notification-worthy. `follow` upserts
    // (idempotent), so a repeat-follow must NOT re-emit the event
    // and re-ping the followee's inbox.
    const alreadyFollowing = await this.follows.exists(cmd.followerId, cmd.followeeId);
    const edge = await this.follows.follow(cmd.followerId, cmd.followeeId);

    if (!alreadyFollowing) {
      const evt: UserFollowedEvent = makeEvent(
        'Social.UserFollowed',
        { followerId: cmd.followerId, followeeId: cmd.followeeId },
        getTraceContext()?.traceId ? { traceId: getTraceContext()!.traceId } : {},
      );
      // Fire-and-forget; a notification failure must never fail the
      // follow itself.
      await this.events.publish(evt);
    }
    return edge;
  }
}
