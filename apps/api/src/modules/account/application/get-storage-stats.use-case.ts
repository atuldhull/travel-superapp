/**
 * V.UX.32 — caller-scoped storage statistics. Powers the
 * `/account/privacy` dashboard ("We store: 24 trips, 130 photos,
 * 8 reviews"). One round-trip per category — a parallel
 * `Promise.all` of cheap indexed counts.
 *
 * Auth-only. Reads only the caller's own rows; soft-deleted users
 * would already have been bounced by the JwtAuthGuard.
 *
 * Installed by prompt [V.UX.32].
 */
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/db/prisma.service';

export interface StorageStats {
  readonly trips: number;
  readonly tripsArchived: number;
  readonly itineraryDays: number;
  readonly itineraryItems: number;
  readonly mediaAssets: number;
  readonly memoryBooks: number;
  readonly reviews: number;
  readonly votes: number;
  readonly expenses: number;
  readonly trustedContacts: number;
  readonly notifications: number;
  readonly pushSubscriptions: number;
  readonly sosEvents: number;
  readonly scamReports: number;
  readonly dishReports: number;
  readonly oauthIdentities: number;
  readonly helpfulVotes: number;
  /** ISO timestamp the stats were computed at — mirror of `Date.now()`. */
  readonly computedAt: string;
}

@Injectable()
export class GetStorageStatsUseCase {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async execute(userId: string): Promise<StorageStats> {
    const [
      trips,
      tripsArchived,
      itineraryDays,
      itineraryItems,
      mediaAssets,
      memoryBooks,
      reviews,
      votes,
      expenses,
      trustedContacts,
      notifications,
      pushSubscriptions,
      sosEvents,
      scamReports,
      dishReports,
      oauthIdentities,
      helpfulVotes,
    ] = await Promise.all([
      this.prisma.trip.count({ where: { userId, archivedAt: null } }),
      this.prisma.trip.count({ where: { userId, archivedAt: { not: null } } }),
      this.prisma.itineraryDay.count({ where: { trip: { userId } } }),
      this.prisma.itineraryItem.count({ where: { day: { trip: { userId } } } }),
      this.prisma.mediaAsset.count({ where: { ownerId: userId } }),
      this.prisma.memoryBook.count({ where: { ownerId: userId } }),
      this.prisma.review.count({ where: { authorId: userId } }),
      this.prisma.vote.count({ where: { userId } }),
      this.prisma.expense.count({ where: { paidById: userId } }),
      this.prisma.trustedContact.count({ where: { userId } }),
      this.prisma.notificationLog.count({ where: { userId } }),
      this.prisma.pushSubscription.count({ where: { userId } }),
      this.prisma.sosEvent.count({ where: { userId } }),
      this.prisma.scamReport.count({ where: { reporterId: userId } }),
      this.prisma.dish.count({ where: { reportedBy: userId } }),
      this.prisma.userOAuthIdentity.count({ where: { userId } }),
      this.prisma.helpfulVote.count({ where: { voterId: userId } }),
    ]);
    return {
      trips,
      tripsArchived,
      itineraryDays,
      itineraryItems,
      mediaAssets,
      memoryBooks,
      reviews,
      votes,
      expenses,
      trustedContacts,
      notifications,
      pushSubscriptions,
      sosEvents,
      scamReports,
      dishReports,
      oauthIdentities,
      helpfulVotes,
      computedAt: new Date().toISOString(),
    };
  }
}
