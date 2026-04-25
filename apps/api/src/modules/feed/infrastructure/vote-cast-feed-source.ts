/**
 * `FeedSource` over the user's cast Vote rows. Excludes
 * `value=0` (abstain) — abstaining isn't really an "I did
 * something" signal worth surfacing in a feed card; only
 * thumbs-up / thumbs-down rows render.
 *
 * Installed by prompt [IV.18.17.2].
 */
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/db/prisma.service';
import type { FeedItem } from '../domain/feed-item.entity';
import type { FeedSource } from '../application/ports/feed-source';

@Injectable()
export class VoteCastFeedSource implements FeedSource {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async recentForUser(
    userId: string,
    before: Date | undefined,
    limit: number,
  ): Promise<readonly FeedItem[]> {
    const rows = await this.prisma.vote.findMany({
      where: {
        userId,
        // Skip abstains — `value: { in: [-1, 1] }` excludes 0
        // without a separate not-equals branch.
        value: { in: [-1, 1] },
        ...(before ? { createdAt: { lt: before } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        tripId: true,
        targetType: true,
        targetId: true,
        value: true,
        createdAt: true,
      },
    });
    return rows.map((v) => ({
      kind: 'vote_cast' as const,
      occurredAt: v.createdAt,
      payload: {
        voteId: v.id,
        tripId: v.tripId,
        targetType: v.targetType,
        targetId: v.targetId,
        value: v.value,
      },
    }));
  }
}
