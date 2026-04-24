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
import { ListTripVotesUseCase } from './application/list-trip-votes.use-case';
import { VOTE_REPOSITORY } from './application/ports/vote.repository';
import { RevokeVoteUseCase } from './application/revoke-vote.use-case';
import { PrismaVoteRepository } from './infrastructure/prisma-vote.repository';
import { SocialController } from './interface/social.controller';

@Module({
  imports: [TripModule],
  controllers: [SocialController],
  providers: [
    { provide: VOTE_REPOSITORY, useClass: PrismaVoteRepository },
    CastVoteUseCase,
    RevokeVoteUseCase,
    ListTripVotesUseCase,
  ],
  exports: [VOTE_REPOSITORY],
})
export class SocialModule {}
