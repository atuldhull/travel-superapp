/**
 * `FeedSource` over the user's own Trip rows.
 *
 * Two action signals: `created` for trips whose `createdAt`
 * IS the latest activity timestamp, and `updated` for trips
 * whose `updatedAt > createdAt` AND `updatedAt` is in the
 * cursor window. The cross-kind sort key is `occurredAt =
 * max(createdAt, updatedAt)` — editing an old trip bumps it
 * back to the top of the feed (which is what users expect:
 * "I just worked on this trip" is the meaningful signal).
 *
 * Single Prisma query — `[userId, status, createdAt]` index
 * already exists on Trip; we sort by `updatedAt` instead and
 * over-fetch a small multiple, then derive `occurredAt`.
 *
 * Installed by prompt [IV.18.17.1].
 */
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/db/prisma.service';
import type { FeedItem } from '../domain/feed-item.entity';
import type { FeedSource } from '../application/ports/feed-source';

@Injectable()
export class TripFeedSource implements FeedSource {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async recentForUser(
    userId: string,
    before: Date | undefined,
    limit: number,
  ): Promise<readonly FeedItem[]> {
    const rows = await this.prisma.trip.findMany({
      where: {
        userId,
        ...(before ? { updatedAt: { lt: before } } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return rows.map((t) => ({
      kind: 'trip' as const,
      occurredAt: t.updatedAt,
      payload: {
        tripId: t.id,
        title: t.title,
        status: t.status,
        action:
          t.updatedAt.getTime() === t.createdAt.getTime()
            ? ('created' as const)
            : ('updated' as const),
      },
    }));
  }
}
