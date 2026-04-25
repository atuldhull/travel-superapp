/**
 * `FeedSource` over Expense rows the user paid for
 * (`paidById == userId`). Mirrors the account-export choice
 * from `[IV.18.16.1]`: only direct authorship is in the feed,
 * not "rows I appear in via splitShare". Including the latter
 * needs JSON-key indexing or a per-user shadow row, neither
 * of which exists today.
 *
 * `amountUsd` is rendered as a 2-decimal string for wire
 * stability (Prisma Decimal → JS float drift). Same pattern
 * the account-export adapter uses.
 *
 * Installed by prompt [IV.18.17.2].
 */
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/db/prisma.service';
import type { FeedItem } from '../domain/feed-item.entity';
import type { FeedSource } from '../application/ports/feed-source';

@Injectable()
export class ExpenseAddedFeedSource implements FeedSource {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async recentForUser(
    userId: string,
    before: Date | undefined,
    limit: number,
  ): Promise<readonly FeedItem[]> {
    const rows = await this.prisma.expense.findMany({
      where: {
        paidById: userId,
        ...(before ? { createdAt: { lt: before } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        tripId: true,
        amountUsd: true,
        currency: true,
        createdAt: true,
      },
    });
    return rows.map((e) => ({
      kind: 'expense_added' as const,
      occurredAt: e.createdAt,
      payload: {
        expenseId: e.id,
        tripId: e.tripId,
        amountUsd: e.amountUsd.toFixed(2),
        currency: e.currency,
      },
    }));
  }
}
