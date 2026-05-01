/**
 * Prisma adapter for `KarmaRepository`. The recompute is two reads
 * + one upsert per user — cheap enough that the nightly scheduler
 * can walk the entire active-reviewer set without batching.
 *
 * Installed by prompt [V.UX.25].
 */
import { Inject, Injectable } from '@nestjs/common';
import type { UserKarma as PrismaKarma } from '@prisma/client';
import { PrismaService } from '../../../common/db/prisma.service';
import type { UserKarma } from '../domain/karma.entity';
import type { KarmaRepository, RecomputeKarmaResult } from '../application/ports/karma.repository';

const SCORE_PER_REVIEW = 1;
const SCORE_PER_HELPFUL = 2;

interface BadgeRule {
  readonly key: string;
  /** Returns true if the user qualifies for this badge given the
   *  current denormalised counters. */
  readonly qualifies: (counters: { reviewCount: number; helpfulVotesReceived: number }) => boolean;
}

const BADGE_RULES: readonly BadgeRule[] = [
  { key: 'contributor_1', qualifies: (c) => c.reviewCount >= 1 },
  { key: 'contributor_10', qualifies: (c) => c.reviewCount >= 10 },
  { key: 'contributor_100', qualifies: (c) => c.reviewCount >= 100 },
  { key: 'helpful_10', qualifies: (c) => c.helpfulVotesReceived >= 10 },
  { key: 'helpful_100', qualifies: (c) => c.helpfulVotesReceived >= 100 },
];

@Injectable()
export class PrismaKarmaRepository implements KarmaRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async recomputeForUser(userId: string): Promise<RecomputeKarmaResult> {
    // Two indexed counts, then a single upsert. groupBy avoids round-
    // tripping every Review row.
    const [reviewCount, helpfulVotesReceived] = await Promise.all([
      this.prisma.review.count({ where: { authorId: userId } }),
      // Helpful votes received = HelpfulVote rows whose review's
      // authorId == userId.
      this.prisma.helpfulVote.count({
        where: { review: { authorId: userId } },
      }),
    ]);
    const score = reviewCount * SCORE_PER_REVIEW + helpfulVotesReceived * SCORE_PER_HELPFUL;
    const badges = BADGE_RULES.filter((r) =>
      r.qualifies({ reviewCount, helpfulVotesReceived }),
    ).map((r) => r.key);

    const existing = await this.prisma.userKarma.findUnique({ where: { userId } });
    const changed =
      !existing ||
      existing.score !== score ||
      existing.reviewCount !== reviewCount ||
      existing.helpfulVotesReceived !== helpfulVotesReceived ||
      badges.length !== existing.badges.length ||
      badges.some((b, i) => b !== existing.badges[i]);

    const row = await this.prisma.userKarma.upsert({
      where: { userId },
      create: {
        userId,
        score,
        reviewCount,
        helpfulVotesReceived,
        badges,
        recomputedAt: new Date(),
      },
      update: {
        score,
        reviewCount,
        helpfulVotesReceived,
        badges,
        recomputedAt: new Date(),
      },
    });
    return { userId, karma: toDomain(row), changed };
  }

  async findByUserId(userId: string): Promise<UserKarma | null> {
    const row = await this.prisma.userKarma.findUnique({ where: { userId } });
    return row ? toDomain(row) : null;
  }

  async listActiveReviewerUserIds(): Promise<readonly string[]> {
    // Distinct authorIds from Review + distinct review-author userIds
    // from HelpfulVote-targeted reviews. Two cheap groupBys; the union
    // happens client-side because Prisma doesn't have a native UNION
    // shorthand. Active set is small enough (low thousands) that this
    // is fine; a future SQL view replaces this if it grows hot.
    const [reviewAuthors, helpfulRecipients] = await Promise.all([
      this.prisma.review.findMany({
        select: { authorId: true },
        distinct: ['authorId'],
      }),
      this.prisma.helpfulVote.findMany({
        select: { review: { select: { authorId: true } } },
      }),
    ]);
    const set = new Set<string>();
    for (const r of reviewAuthors) set.add(r.authorId);
    for (const h of helpfulRecipients) set.add(h.review.authorId);
    return Array.from(set);
  }
}

function toDomain(row: PrismaKarma): UserKarma {
  return {
    id: row.id,
    userId: row.userId,
    score: row.score,
    reviewCount: row.reviewCount,
    helpfulVotesReceived: row.helpfulVotesReceived,
    badges: row.badges,
    recomputedAt: row.recomputedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
