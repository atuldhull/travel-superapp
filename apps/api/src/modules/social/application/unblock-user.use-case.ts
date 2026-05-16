/**
 * POST.2B.1 — unblock a user (idempotent: unblocking a non-edge is
 * a no-op, never throws).
 *
 * Installed by prompt [POST.2B.1].
 */
import { Inject, Injectable } from '@nestjs/common';
import { BLOCK_REPOSITORY, type BlockRepository } from './ports/block.repository';

export interface UnblockUserCommand {
  readonly blockerId: string;
  readonly blockedId: string;
}

@Injectable()
export class UnblockUserUseCase {
  constructor(@Inject(BLOCK_REPOSITORY) private readonly blocks: BlockRepository) {}

  async execute(cmd: UnblockUserCommand): Promise<void> {
    await this.blocks.unblock(cmd.blockerId, cmd.blockedId);
  }
}
