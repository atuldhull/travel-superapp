/**
 * Prisma adapter for GamificationRepository.
 *
 * `applyAward` is a single prisma.$transaction: upsert the profile +
 * `createMany skipDuplicates` the new badges. Pure DB, zero network
 * inside the txn (CLAUDE.md #13 only forbids network in a txn).
 * Badge inserts are idempotent via the `@@unique([userId, badgeKey])`
 * so a retried award never double-grants.
 *
 * Installed for the adventure-diary feature.
 */
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/db/prisma.service';
import type {
  ApplyAwardInput,
  GamificationRepository,
  GamificationSnapshot,
} from '../application/ports/gamification.repository';

@Injectable()
export class PrismaGamificationRepository implements GamificationRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async snapshot(userId: string): Promise<GamificationSnapshot> {
    const [profile, badges] = await Promise.all([
      this.prisma.gamificationProfile.findUnique({ where: { userId } }),
      this.prisma.earnedBadge.findMany({
        where: { userId },
        select: { badgeKey: true },
      }),
    ]);
    return {
      totalPoints: profile?.totalPoints ?? 0,
      currentStreak: profile?.currentStreak ?? 0,
      longestStreak: profile?.longestStreak ?? 0,
      entryCount: profile?.entryCount ?? 0,
      aiAssistCount: profile?.aiAssistCount ?? 0,
      lastEntryOn: profile?.lastEntryOn ?? null,
      earnedBadgeKeys: badges.map((b) => b.badgeKey),
    };
  }

  async applyAward(input: ApplyAwardInput): Promise<void> {
    const { userId, next, newlyEarnedBadges } = input;
    await this.prisma.$transaction(async (tx) => {
      await tx.gamificationProfile.upsert({
        where: { userId },
        create: {
          userId,
          totalPoints: next.totalPoints,
          currentStreak: next.currentStreak,
          longestStreak: next.longestStreak,
          entryCount: next.entryCount,
          aiAssistCount: next.aiAssistCount,
          lastEntryOn: next.lastEntryOn,
        },
        update: {
          totalPoints: next.totalPoints,
          currentStreak: next.currentStreak,
          longestStreak: next.longestStreak,
          entryCount: next.entryCount,
          aiAssistCount: next.aiAssistCount,
          lastEntryOn: next.lastEntryOn,
        },
      });
      if (newlyEarnedBadges.length > 0) {
        await tx.earnedBadge.createMany({
          data: newlyEarnedBadges.map((badgeKey) => ({ userId, badgeKey })),
          skipDuplicates: true,
        });
      }
    });
  }
}
