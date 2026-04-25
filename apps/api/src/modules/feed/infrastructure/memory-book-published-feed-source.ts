/**
 * `FeedSource` over the user's MemoryBook rows that have
 * been published. The meaningful event is "I shared this
 * album", not "I started a draft" — so `occurredAt` is
 * `publishedAt`, NOT `createdAt`. A drafted-but-never-
 * published book never appears in the feed.
 *
 * Installed by prompt [IV.18.17.1].
 */
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/db/prisma.service';
import type { FeedItem } from '../domain/feed-item.entity';
import type { FeedSource } from '../application/ports/feed-source';

@Injectable()
export class MemoryBookPublishedFeedSource implements FeedSource {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async recentForUser(
    userId: string,
    before: Date | undefined,
    limit: number,
  ): Promise<readonly FeedItem[]> {
    const rows = await this.prisma.memoryBook.findMany({
      where: {
        ownerId: userId,
        publishedAt: {
          // Must be published (not null) AND older than `before`
          // when a cursor is supplied.
          not: null,
          ...(before ? { lt: before } : {}),
        },
      },
      orderBy: { publishedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        title: true,
        publishedAt: true,
      },
    });
    return rows
      .filter((b): b is typeof b & { publishedAt: Date } => b.publishedAt !== null)
      .map((b) => ({
        kind: 'memory_book_published' as const,
        occurredAt: b.publishedAt,
        payload: {
          memoryBookId: b.id,
          title: b.title,
        },
      }));
  }
}
