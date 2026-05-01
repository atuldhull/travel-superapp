/**
 * Prisma adapter for `HelpfulVoteRepository`. The unique
 * `(reviewId, voterId)` index does the dedup; we catch the
 * Prisma `P2002` error and surface `'duplicate'` so the use-case
 * can return an idempotent 200.
 *
 * Installed by prompt [V.UX.25].
 */
import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/db/prisma.service';
import type { HelpfulVoteRepository } from '../application/ports/helpful-vote.repository';

@Injectable()
export class PrismaHelpfulVoteRepository implements HelpfulVoteRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async insertOnce(input: {
    readonly reviewId: string;
    readonly voterId: string;
  }): Promise<'inserted' | 'duplicate'> {
    try {
      await this.prisma.helpfulVote.create({
        data: { reviewId: input.reviewId, voterId: input.voterId },
      });
      return 'inserted';
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return 'duplicate';
      }
      throw err;
    }
  }

  async countForReview(reviewId: string): Promise<number> {
    return this.prisma.helpfulVote.count({ where: { reviewId } });
  }
}
