/**
 * POST.2B.1 — block a user + the shared block gate.
 *
 * `assertNotBlocked` is the single gate the reaction use-cases
 * (follow / cast-vote / create-review) consult — block is a domain
 * concept, enforced alongside the existing application gates (NOT a
 * new layer; verified: that's where assertCanVote lives).
 *
 * Installed by prompt [POST.2B.1].
 */
import { Inject, Injectable } from '@nestjs/common';
import { ForbiddenError, ValidationError } from '@app/errors';
import type { UserBlock } from '../domain/user-block.entity';
import { BLOCK_REPOSITORY, type BlockRepository } from './ports/block.repository';

export interface BlockUserCommand {
  readonly blockerId: string;
  readonly blockedId: string;
}

/**
 * Throws 403 BLOCKED_INTERACTION if a block exists in EITHER
 * direction between the two users. Called alongside the existing
 * trip-access gate in cast-vote / create-review, and up-front in
 * follow.
 */
export async function assertNotBlocked(
  blocks: BlockRepository,
  a: string,
  b: string,
): Promise<void> {
  if (await blocks.existsBetween(a, b)) {
    throw new ForbiddenError(
      'Interaction not allowed: one of you has blocked the other',
      { a, b },
      'BLOCKED_INTERACTION',
    );
  }
}

@Injectable()
export class BlockUserUseCase {
  constructor(@Inject(BLOCK_REPOSITORY) private readonly blocks: BlockRepository) {}

  async execute(cmd: BlockUserCommand): Promise<UserBlock> {
    if (cmd.blockerId === cmd.blockedId) {
      throw new ValidationError(
        'Cannot block yourself',
        { blockedId: ['cannot be self'] },
        {},
        'CANNOT_BLOCK_SELF',
      );
    }
    return this.blocks.block(cmd.blockerId, cmd.blockedId);
  }
}
