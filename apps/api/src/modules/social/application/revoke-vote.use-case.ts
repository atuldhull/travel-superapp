/**
 * Remove the caller's own vote on a trip target. Same auth gate
 * as cast-vote (owner OR trip has active share). Returns void on
 * success; 404 if no matching vote existed (so a revoke-without-
 * a-prior-vote is a clean 404 rather than a silent no-op).
 *
 * Installed by prompt [IV.18.12.3].
 */
import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '@app/errors';
import {
  TRIP_REPOSITORY,
  TRIP_SHARE_REPOSITORY,
  type TripRepository,
  type TripShareRepository,
} from '../../trip';

import type { VoteTargetType } from '../domain/vote.entity';
import { assertCanVote } from './cast-vote.use-case';
import { VOTE_REPOSITORY, type VoteRepository } from './ports/vote.repository';

export interface RevokeVoteCommand {
  readonly tripId: string;
  readonly userId: string;
  readonly targetType: VoteTargetType;
  readonly targetId: string;
}

@Injectable()
export class RevokeVoteUseCase {
  constructor(
    @Inject(VOTE_REPOSITORY) private readonly votes: VoteRepository,
    @Inject(TRIP_REPOSITORY) private readonly trips: TripRepository,
    @Inject(TRIP_SHARE_REPOSITORY) private readonly shares: TripShareRepository,
  ) {}

  async execute(cmd: RevokeVoteCommand): Promise<void> {
    await assertCanVote(this.trips, this.shares, cmd.tripId, cmd.userId);
    const removed = await this.votes.deleteForUser({
      tripId: cmd.tripId,
      userId: cmd.userId,
      targetType: cmd.targetType,
      targetId: cmd.targetId,
    });
    if (!removed) {
      throw new NotFoundError(
        `Vote not found for (${cmd.targetType}, ${cmd.targetId})`,
        {
          tripId: cmd.tripId,
          targetType: cmd.targetType,
          targetId: cmd.targetId,
        },
        'VOTE_NOT_FOUND',
      );
    }
  }
}
