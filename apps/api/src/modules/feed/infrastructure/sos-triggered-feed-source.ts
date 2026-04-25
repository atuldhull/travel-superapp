/**
 * `FeedSource` over the user's own `SosEvent` rows. Single
 * Prisma read on the existing `[userId, createdAt]` index.
 * `occurredAt = createdAt` — "I triggered SOS at this time" is
 * the meaningful event; resolution is surfaced as
 * `payload.resolvedAt` so a card can render "active" vs
 * "resolved" without a second lookup.
 *
 * Installed by prompt [IV.18.17.2].
 */
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/db/prisma.service';
import type { FeedItem } from '../domain/feed-item.entity';
import type { FeedSource } from '../application/ports/feed-source';

@Injectable()
export class SosTriggeredFeedSource implements FeedSource {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async recentForUser(
    userId: string,
    before: Date | undefined,
    limit: number,
  ): Promise<readonly FeedItem[]> {
    const rows = await this.prisma.sosEvent.findMany({
      where: {
        userId,
        ...(before ? { createdAt: { lt: before } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        trigger: true,
        resolvedAt: true,
        createdAt: true,
      },
    });
    return rows.map((s) => ({
      kind: 'sos_triggered' as const,
      occurredAt: s.createdAt,
      payload: {
        sosEventId: s.id,
        trigger: s.trigger,
        resolvedAt: s.resolvedAt ? s.resolvedAt.toISOString() : null,
      },
    }));
  }
}
