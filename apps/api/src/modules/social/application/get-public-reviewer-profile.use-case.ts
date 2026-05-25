/**
 * V.UX.25 — public reviewer profile. Bundles karma + the user's
 * recent reviews into one round-trip for `/users/:id` (public —
 * no auth required, mirrors the place / stay review-summary surfaces).
 *
 * 404 USER_NOT_FOUND when the userId doesn't exist. Karma is
 * read lazily — if the user has never been recomputed, we synthesise
 * a zero-shape so the page always renders.
 *
 * Installed by prompt [V.UX.25].
 */
import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type Clock } from '@app/clock';
import { NotFoundError } from '@app/errors';
import { PrismaService } from '../../../common/db/prisma.service';
import type { PublicReviewerProfile, UserKarma } from '../domain/karma.entity';
import { KARMA_REPOSITORY, type KarmaRepository } from './ports/karma.repository';
import { REVIEW_REPOSITORY, type ReviewRepository } from './ports/review.repository';

const DEFAULT_RECENT = 10;
const MAX_RECENT = 50;

export interface GetPublicReviewerProfileCommand {
  readonly userId: string;
  readonly recentLimit?: number;
}

@Injectable()
export class GetPublicReviewerProfileUseCase {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(KARMA_REPOSITORY) private readonly karma: KarmaRepository,
    @Inject(REVIEW_REPOSITORY) private readonly reviews: ReviewRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(cmd: GetPublicReviewerProfileCommand): Promise<PublicReviewerProfile> {
    const limit =
      cmd.recentLimit === undefined
        ? DEFAULT_RECENT
        : Math.max(1, Math.min(MAX_RECENT, Math.floor(cmd.recentLimit)));

    const user = await this.prisma.user.findUnique({
      where: { id: cmd.userId },
      select: { id: true, displayName: true, deletedAt: true },
    });
    if (!user || user.deletedAt !== null) {
      throw new NotFoundError('User not found', { userId: cmd.userId }, 'USER_NOT_FOUND');
    }

    const [karma, recentReviews] = await Promise.all([
      this.karma.findByUserId(cmd.userId),
      this.reviews.listByAuthor(cmd.userId, limit),
    ]);

    return {
      userId: user.id,
      displayName: user.displayName,
      karma: karma ?? synthesiseZeroKarma(cmd.userId, this.clock.now()),
      recentReviews: recentReviews.map((r) => ({
        id: r.id,
        targetType: r.targetType,
        targetId: r.targetId,
        rating: r.rating,
        body: r.body,
        createdAt: r.createdAt,
      })),
    };
  }
}

// [M6] Accepts `now` so the caller (the use-case, which injects CLOCK)
// can pass `this.clock.now()` for deterministic test time.
function synthesiseZeroKarma(userId: string, now: Date = new Date()): UserKarma {
  return {
    id: '',
    userId,
    score: 0,
    reviewCount: 0,
    helpfulVotesReceived: 0,
    badges: [],
    recomputedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}
