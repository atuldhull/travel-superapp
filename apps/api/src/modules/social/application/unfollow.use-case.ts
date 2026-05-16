/**
 * POST.2B.1 — unfollow a user (idempotent: unfollowing a non-edge
 * is a no-op, never throws).
 *
 * Installed by prompt [POST.2B.1].
 */
import { Inject, Injectable } from '@nestjs/common';
import { FOLLOW_REPOSITORY, type FollowRepository } from './ports/follow.repository';

export interface UnfollowCommand {
  readonly followerId: string;
  readonly followeeId: string;
}

@Injectable()
export class UnfollowUseCase {
  constructor(@Inject(FOLLOW_REPOSITORY) private readonly follows: FollowRepository) {}

  async execute(cmd: UnfollowCommand): Promise<void> {
    await this.follows.unfollow(cmd.followerId, cmd.followeeId);
  }
}
