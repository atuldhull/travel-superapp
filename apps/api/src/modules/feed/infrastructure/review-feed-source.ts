/**
 * `FeedSource` over the user's authored Review rows. Single
 * Prisma read on the existing `[authorId, createdAt]` index.
 *
 * Installed by prompt [IV.18.17.1].
 */
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/db/prisma.service';
import type { FeedItem } from '../domain/feed-item.entity';
import type { FeedSource } from '../application/ports/feed-source';

@Injectable()
export class ReviewFeedSource implements FeedSource {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async recentForUser(
    userId: string,
    before: Date | undefined,
    limit: number,
  ): Promise<readonly FeedItem[]> {
    const rows = await this.prisma.review.findMany({
      where: {
        authorId: userId,
        ...(before ? { createdAt: { lt: before } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        targetType: true,
        targetId: true,
        rating: true,
        createdAt: true,
      },
    });
    return rows.map((r) => ({
      kind: 'review' as const,
      occurredAt: r.createdAt,
      payload: {
        reviewId: r.id,
        targetType: r.targetType,
        targetId: r.targetId,
        rating: r.rating,
      },
    }));
  }
}
