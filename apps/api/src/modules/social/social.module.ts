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
import { Module } from '@nestjs/common';
import { TripModule } from '../trip/trip.module';
import { CastVoteUseCase } from './application/cast-vote.use-case';
import { CreateExpenseUseCase } from './application/create-expense.use-case';
import { CreateReviewUseCase } from './application/create-review.use-case';
import { DeleteExpenseUseCase } from './application/delete-expense.use-case';
import { DeleteReviewUseCase } from './application/delete-review.use-case';
import { GetReviewBundleForTargetUseCase } from './application/get-review-bundle-for-target.use-case';
import { GetReviewSummaryUseCase } from './application/get-review-summary.use-case';
import { GetTripBalancesUseCase } from './application/get-trip-balances.use-case';
import { SettleUpUseCase } from './application/settle-up.use-case';
import { GetVoteSummaryUseCase } from './application/get-vote-summary.use-case';
import { ListMyReviewsUseCase } from './application/list-my-reviews.use-case';
import { ListReviewsForTargetUseCase } from './application/list-reviews-for-target.use-case';
import { ListTripExpensesUseCase } from './application/list-trip-expenses.use-case';
import { ListTripVotesUseCase } from './application/list-trip-votes.use-case';
import { EXPENSE_REPOSITORY } from './application/ports/expense.repository';
import { REVIEW_REPOSITORY } from './application/ports/review.repository';
import { VOTE_REPOSITORY } from './application/ports/vote.repository';
import { RevokeVoteUseCase } from './application/revoke-vote.use-case';
import { PrismaExpenseRepository } from './infrastructure/prisma-expense.repository';
import { PrismaReviewRepository } from './infrastructure/prisma-review.repository';
import { PrismaVoteRepository } from './infrastructure/prisma-vote.repository';
import { TripBalancesCache } from './infrastructure/trip-balances-cache';
import { AgentReviewSummaryController } from './interface/agent-review-summary.controller';
import { EateryReviewSummaryController } from './interface/eatery-review-summary.controller';
import { ExpensesController } from './interface/expenses.controller';
import { PlaceReviewSummaryController } from './interface/place-review-summary.controller';
import { ReviewsController } from './interface/reviews.controller';
import { SocialController } from './interface/social.controller';
import { StayReviewSummaryController } from './interface/stay-review-summary.controller';
import { VotesController } from './interface/votes.controller';

@Module({
  imports: [TripModule],
  controllers: [
    SocialController,
    ExpensesController,
    ReviewsController,
    VotesController,
    PlaceReviewSummaryController,
    StayReviewSummaryController,
    EateryReviewSummaryController,
    AgentReviewSummaryController,
  ],
  providers: [
    { provide: VOTE_REPOSITORY, useClass: PrismaVoteRepository },
    { provide: EXPENSE_REPOSITORY, useClass: PrismaExpenseRepository },
    { provide: REVIEW_REPOSITORY, useClass: PrismaReviewRepository },
    CastVoteUseCase,
    RevokeVoteUseCase,
    ListTripVotesUseCase,
    CreateExpenseUseCase,
    DeleteExpenseUseCase,
    ListTripExpensesUseCase,
    GetTripBalancesUseCase,
    SettleUpUseCase,
    CreateReviewUseCase,
    DeleteReviewUseCase,
    ListReviewsForTargetUseCase,
    ListMyReviewsUseCase,
    GetReviewSummaryUseCase,
    GetVoteSummaryUseCase,
    GetReviewBundleForTargetUseCase,
    TripBalancesCache,
  ],
  exports: [VOTE_REPOSITORY, EXPENSE_REPOSITORY, REVIEW_REPOSITORY],
})
export class SocialModule {}
