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
import { DeleteExpenseUseCase } from './application/delete-expense.use-case';
import { GetTripBalancesUseCase } from './application/get-trip-balances.use-case';
import { ListTripExpensesUseCase } from './application/list-trip-expenses.use-case';
import { ListTripVotesUseCase } from './application/list-trip-votes.use-case';
import { EXPENSE_REPOSITORY } from './application/ports/expense.repository';
import { VOTE_REPOSITORY } from './application/ports/vote.repository';
import { RevokeVoteUseCase } from './application/revoke-vote.use-case';
import { PrismaExpenseRepository } from './infrastructure/prisma-expense.repository';
import { PrismaVoteRepository } from './infrastructure/prisma-vote.repository';
import { ExpensesController } from './interface/expenses.controller';
import { SocialController } from './interface/social.controller';

@Module({
  imports: [TripModule],
  controllers: [SocialController, ExpensesController],
  providers: [
    { provide: VOTE_REPOSITORY, useClass: PrismaVoteRepository },
    { provide: EXPENSE_REPOSITORY, useClass: PrismaExpenseRepository },
    CastVoteUseCase,
    RevokeVoteUseCase,
    ListTripVotesUseCase,
    CreateExpenseUseCase,
    DeleteExpenseUseCase,
    ListTripExpensesUseCase,
    GetTripBalancesUseCase,
  ],
  exports: [VOTE_REPOSITORY, EXPENSE_REPOSITORY],
})
export class SocialModule {}
