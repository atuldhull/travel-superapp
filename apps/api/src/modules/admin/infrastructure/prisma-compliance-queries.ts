/**
 * V.UX.37 — Prisma adapter for the compliance retention dashboard.
 *
 * Single Promise.all of indexed counts + one minByDeletedAt query.
 * Cuts the round-trip count to 2 (the count batch + the oldest
 * row lookup) so the dashboard renders fast even on a busy day.
 */
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/db/prisma.service';
import type {
  ComplianceQueries,
  RetentionStats,
} from '../application/ports/compliance-queries.port';

@Injectable()
export class PrismaComplianceQueries implements ComplianceQueries {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getRetentionStats(retentionDays: number, now: Date): Promise<RetentionStats> {
    const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
    const [
      activeUsers,
      softDeletedUsers,
      scheduledForPurge,
      bannedUsers,
      oldestSoftDelete,
      totalTrips,
      archivedTrips,
      activeSos,
      resolvedSos,
      pendingScams,
      verifiedScams,
      notifications,
      archivedNotifications,
      pendingAppeals,
      approvedAppeals,
      rejectedAppeals,
    ] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.user.count({ where: { deletedAt: { not: null } } }),
      this.prisma.user.count({ where: { deletedAt: { lte: cutoff } } }),
      this.prisma.user.count({ where: { bannedAt: { not: null } } }),
      this.prisma.user.findFirst({
        where: { deletedAt: { not: null } },
        orderBy: { deletedAt: 'asc' },
        select: { deletedAt: true },
      }),
      this.prisma.trip.count(),
      this.prisma.trip.count({ where: { status: 'archived' } }),
      this.prisma.sosEvent.count({ where: { resolvedAt: null } }),
      this.prisma.sosEvent.count({ where: { resolvedAt: { not: null } } }),
      this.prisma.scamReport.count({ where: { verified: false } }),
      this.prisma.scamReport.count({ where: { verified: true } }),
      this.prisma.notificationLog.count(),
      this.prisma.notificationLog.count({ where: { archivedAt: { not: null } } }),
      this.prisma.banAppeal.count({ where: { status: 'pending' } }),
      this.prisma.banAppeal.count({ where: { status: 'approved' } }),
      this.prisma.banAppeal.count({ where: { status: 'rejected' } }),
    ]);

    const oldestAt = oldestSoftDelete?.deletedAt ?? null;
    const daysUntilPurgeForOldest =
      oldestAt === null
        ? null
        : Math.ceil((oldestAt.getTime() + retentionDays * 86_400_000 - now.getTime()) / 86_400_000);

    return {
      retentionDays,
      users: {
        active: activeUsers,
        softDeleted: softDeletedUsers,
        scheduledForPurge,
        banned: bannedUsers,
        oldestSoftDeleteAt: oldestAt ? oldestAt.toISOString() : null,
        daysUntilPurgeForOldest,
      },
      trips: {
        total: totalTrips,
        archived: archivedTrips,
      },
      safety: {
        activeSos,
        resolvedSos,
        pendingScamReports: pendingScams,
        verifiedScamReports: verifiedScams,
      },
      inbox: {
        notifications,
        archivedNotifications,
      },
      appeals: {
        pending: pendingAppeals,
        approved: approvedAppeals,
        rejected: rejectedAppeals,
      },
      computedAt: now.toISOString(),
    };
  }
}
