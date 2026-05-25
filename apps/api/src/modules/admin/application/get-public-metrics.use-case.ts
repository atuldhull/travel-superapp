/**
 * V.UX.40 — sanitized public counts for the landing-page live-metrics
 * strip. ANONYMIZED — no per-user data, only aggregate totals over a
 * rolling time window.
 *
 * Three counters:
 *   - tripsThisMonth      — trips created in the last 30 days.
 *   - memoryBooksThisMonth — memory books created in the last 30d.
 *   - activeUsersThisWeek  — distinct users with `lastSeenAt > 7d ago`.
 *
 * Surface is `@Public()` + 5-minute Redis cache (in the controller).
 * Numbers can leak business signal so we round to the nearest 10
 * for any value < 1000 — just enough fuzz that exact churn isn't
 * inferable from polling.
 */
import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type Clock } from '@app/clock';
import { PrismaService } from '../../../common/db/prisma.service';

export interface PublicMetrics {
  readonly tripsThisMonth: number;
  readonly memoryBooksThisMonth: number;
  readonly activeUsersThisWeek: number;
  readonly computedAt: string;
}

const MS_DAY = 24 * 60 * 60 * 1000;

function fuzz(n: number): number {
  if (n >= 1000) return n;
  return Math.round(n / 10) * 10;
}

@Injectable()
export class GetPublicMetricsUseCase {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(): Promise<PublicMetrics> {
    const now = this.clock.now();
    const monthAgo = new Date(now.getTime() - 30 * MS_DAY);
    const weekAgo = new Date(now.getTime() - 7 * MS_DAY);
    const [trips, books, activeUsers] = await Promise.all([
      this.prisma.trip.count({ where: { createdAt: { gte: monthAgo } } }),
      this.prisma.memoryBook.count({ where: { createdAt: { gte: monthAgo } } }),
      this.prisma.user.count({
        where: { deletedAt: null, lastSeenAt: { gte: weekAgo } },
      }),
    ]);
    return {
      tripsThisMonth: fuzz(trips),
      memoryBooksThisMonth: fuzz(books),
      activeUsersThisWeek: fuzz(activeUsers),
      computedAt: now.toISOString(),
    };
  }
}
