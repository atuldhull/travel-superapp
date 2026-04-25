/**
 * `FeedSource` over the user's filed ScamReport rows. Single
 * Prisma read on the existing `[reporterId, createdAt]` index.
 *
 * Installed by prompt [IV.18.17.1].
 */
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/db/prisma.service';
import type { FeedItem } from '../domain/feed-item.entity';
import type { FeedSource } from '../application/ports/feed-source';

@Injectable()
export class ScamReportFeedSource implements FeedSource {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async recentForUser(
    userId: string,
    before: Date | undefined,
    limit: number,
  ): Promise<readonly FeedItem[]> {
    const rows = await this.prisma.scamReport.findMany({
      where: {
        reporterId: userId,
        ...(before ? { createdAt: { lt: before } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        category: true,
        severity: true,
        verified: true,
        createdAt: true,
      },
    });
    return rows.map((r) => ({
      kind: 'scam_report' as const,
      occurredAt: r.createdAt,
      payload: {
        scamReportId: r.id,
        category: r.category,
        severity: r.severity,
        verified: r.verified,
      },
    }));
  }
}
