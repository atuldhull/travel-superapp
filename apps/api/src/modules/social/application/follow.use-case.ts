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
import { ValidationError } from '@app/errors';
import type { Follow } from '../domain/follow.entity';
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
    return this.follows.follow(cmd.followerId, cmd.followeeId);
  }
}
