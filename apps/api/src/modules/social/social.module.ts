/**
 * Social feature module. v1 surface is voting; expenses + reviews
 * (the other two entities in Playbook §3.12) land in follow-up
 * slices — each will add its own ports + use-cases here.
 *
 *   controller (interface)
 *     → CastVote / RevokeVote / ListTripVotes (application)
 *       → VOTE_REPOSITORY (application port)
 *         ← PrismaVoteRepository (infrastructure)
 *
 * Imports TripModule to reach TRIP_REPOSITORY + TRIP_SHARE_REPOSITORY
 * for the collaborative-voting gate ("caller owns the trip OR the
 * trip has an active share"). Trip doesn't import back — Social is
 * a strict downstream consumer.
 *
 * Installed by prompt [IV.18.12.3].
 */
import { Module, forwardRef } from '@nestjs/common';
import { SafetyModule } from '../safety/safety.module';
import { TripModule } from '../trip/trip.module';
import { CastHelpfulVoteUseCase } from './application/cast-helpful-vote.use-case';
import { CastVoteUseCase } from './application/cast-vote.use-case';
import { CreateExpenseUseCase } from './application/create-expense.use-case';
import { CreateReviewUseCase } from './application/create-review.use-case';
import { DeleteExpenseUseCase } from './application/delete-expense.use-case';
import { DeleteReviewUseCase } from './application/delete-review.use-case';
import { GetPublicReviewerProfileUseCase } from './application/get-public-reviewer-profile.use-case';
import { GetReviewBundleForTargetUseCase } from './application/get-review-bundle-for-target.use-case';
import { GetReviewSummaryUseCase } from './application/get-review-summary.use-case';
import { GetTripBalancesUseCase } from './application/get-trip-balances.use-case';
import { SettleUpUseCase } from './application/settle-up.use-case';
import { HeartSharedTripUseCase } from './application/heart-shared-trip.use-case';
import { RecomputeKarmaUseCase } from './application/recompute-karma.use-case';
import { TripHeartCounter } from './infrastructure/trip-heart-counter';
import { SharedTripReactController } from './interface/shared-trip-react.controller';
import { GetVoteSummaryUseCase } from './application/get-vote-summary.use-case';
import { ListMyReviewsUseCase } from './application/list-my-reviews.use-case';
import { ListReviewsForTargetUseCase } from './application/list-reviews-for-target.use-case';
import { ListTripExpensesUseCase } from './application/list-trip-expenses.use-case';
import { ListTripVotesUseCase } from './application/list-trip-votes.use-case';
import { EXPENSE_REPOSITORY } from './application/ports/expense.repository';
import { HELPFUL_VOTE_REPOSITORY } from './application/ports/helpful-vote.repository';
import { KARMA_REPOSITORY } from './application/ports/karma.repository';
import { REVIEW_REPOSITORY } from './application/ports/review.repository';
import { VOTE_REPOSITORY } from './application/ports/vote.repository';
import { RespondToReviewUseCase } from './application/respond-to-review.use-case';
import { RevokeVoteUseCase } from './application/revoke-vote.use-case';
import { PrismaExpenseRepository } from './infrastructure/prisma-expense.repository';
import { PrismaHelpfulVoteRepository } from './infrastructure/prisma-helpful-vote.repository';
import { PrismaKarmaRepository } from './infrastructure/prisma-karma.repository';
// POST.2B.1 — social graph (follow + block)
import { FOLLOW_REPOSITORY } from './application/ports/follow.repository';
import { BLOCK_REPOSITORY } from './application/ports/block.repository';
import { PrismaFollowRepository } from './infrastructure/prisma-follow.repository';
import { PrismaBlockRepository } from './infrastructure/prisma-block.repository';
import { FollowUseCase } from './application/follow.use-case';
import { UnfollowUseCase } from './application/unfollow.use-case';
import { BlockUserUseCase } from './application/block-user.use-case';
import { UnblockUserUseCase } from './application/unblock-user.use-case';
import { ListConnectionsUseCase } from './application/list-connections.use-case';
import { FollowController } from './interface/follow.controller';
// Phase 5 (J4) — trip comments
import { COMMENT_REPOSITORY } from './application/ports/comment.repository';
import { PrismaCommentRepository } from './infrastructure/prisma-comment.repository';
import { CreateCommentUseCase } from './application/create-comment.use-case';
import { ListCommentsUseCase } from './application/list-comments.use-case';
import { DeleteCommentUseCase } from './application/delete-comment.use-case';
import { CommentsController } from './interface/comments.controller';
import { PrismaReviewRepository } from './infrastructure/prisma-review.repository';
import { PrismaVoteRepository } from './infrastructure/prisma-vote.repository';
import { TripBalancesCache } from './infrastructure/trip-balances-cache';
import { AgentReviewSummaryController } from './interface/agent-review-summary.controller';
import { EateryReviewSummaryController } from './interface/eatery-review-summary.controller';
import { ExpensesController } from './interface/expenses.controller';
import { KarmaRecomputeScheduler } from './interface/karma-recompute.scheduler';
import { PlaceReviewSummaryController } from './interface/place-review-summary.controller';
import { PublicUserProfileController } from './interface/public-user-profile.controller';
import { ReviewsController } from './interface/reviews.controller';
import { SocialController } from './interface/social.controller';
import { StayReviewSummaryController } from './interface/stay-review-summary.controller';
import { VotesController } from './interface/votes.controller';

@Module({
  // V.UX.24 — pulls AGENT_REPOSITORY from SafetyModule so the
  // RespondToReviewUseCase can owner-gate against the caller's
  // Agent row. forwardRef because cross-module loops are easy to
  // introduce here as new persona surfaces land.
  imports: [TripModule, forwardRef(() => SafetyModule)],
  controllers: [
    SocialController,
    ExpensesController,
    ReviewsController,
    VotesController,
    PlaceReviewSummaryController,
    StayReviewSummaryController,
    EateryReviewSummaryController,
    AgentReviewSummaryController,
    SharedTripReactController,
    PublicUserProfileController,
    FollowController,
    CommentsController,
  ],
  providers: [
    { provide: VOTE_REPOSITORY, useClass: PrismaVoteRepository },
    { provide: EXPENSE_REPOSITORY, useClass: PrismaExpenseRepository },
    { provide: REVIEW_REPOSITORY, useClass: PrismaReviewRepository },
    { provide: HELPFUL_VOTE_REPOSITORY, useClass: PrismaHelpfulVoteRepository },
    { provide: KARMA_REPOSITORY, useClass: PrismaKarmaRepository },
    { provide: FOLLOW_REPOSITORY, useClass: PrismaFollowRepository },
    { provide: BLOCK_REPOSITORY, useClass: PrismaBlockRepository },
    FollowUseCase,
    UnfollowUseCase,
    BlockUserUseCase,
    UnblockUserUseCase,
    ListConnectionsUseCase,
    { provide: COMMENT_REPOSITORY, useClass: PrismaCommentRepository },
    CreateCommentUseCase,
    ListCommentsUseCase,
    DeleteCommentUseCase,
    CastVoteUseCase,
    RevokeVoteUseCase,
    ListTripVotesUseCase,
    CreateExpenseUseCase,
    DeleteExpenseUseCase,
    ListTripExpensesUseCase,
    GetTripBalancesUseCase,
    SettleUpUseCase,
    HeartSharedTripUseCase,
    TripHeartCounter,
    CreateReviewUseCase,
    DeleteReviewUseCase,
    ListReviewsForTargetUseCase,
    ListMyReviewsUseCase,
    GetReviewSummaryUseCase,
    GetVoteSummaryUseCase,
    GetReviewBundleForTargetUseCase,
    RespondToReviewUseCase,
    CastHelpfulVoteUseCase,
    RecomputeKarmaUseCase,
    GetPublicReviewerProfileUseCase,
    KarmaRecomputeScheduler,
    TripBalancesCache,
  ],
  exports: [VOTE_REPOSITORY, EXPENSE_REPOSITORY, REVIEW_REPOSITORY, KARMA_REPOSITORY],
})
export class SocialModule {}
