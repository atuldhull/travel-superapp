/**
 * Aggregate all votes on a trip into per-target tallies. Same
 * auth gate as cast / revoke — you must own the trip OR the trip
 * must have an active published share.
 *
 * Output is `VoteTally[]`: one row per distinct target, with
 * up/meh/down counts + a net score + the authed caller's own
 * vote (so the UI can render "you voted 👍" decorations without
 * a second round-trip).
 *
 * Privacy: per-user votes are NOT returned. Aggregated counts +
 * `mine` hide who voted what. A future "reveal who voted" surface
 * for the trip owner can land as its own use-case — keeping the
 * default private by design.
 *
 * Installed by prompt [IV.18.12.3].
 */
import { Inject, Injectable } from '@nestjs/common';
import { TRIP_REPOSITORY, type TripRepository } from '../../trip/application/ports/trip.repository';
import {
  TRIP_SHARE_REPOSITORY,
  type TripShareRepository,
} from '../../trip/application/ports/trip-share.repository';
import type { VoteTally, VoteTargetType, VoteValue } from '../domain/vote.entity';
import { assertCanVote } from './cast-vote.use-case';
import { VOTE_REPOSITORY, type VoteRepository } from './ports/vote.repository';

export interface ListTripVotesCommand {
  readonly tripId: string;
  readonly userId: string;
}

@Injectable()
export class ListTripVotesUseCase {
  constructor(
    @Inject(VOTE_REPOSITORY) private readonly votes: VoteRepository,
    @Inject(TRIP_REPOSITORY) private readonly trips: TripRepository,
    @Inject(TRIP_SHARE_REPOSITORY) private readonly shares: TripShareRepository,
  ) {}

  async execute(cmd: ListTripVotesCommand): Promise<readonly VoteTally[]> {
    await assertCanVote(this.trips, this.shares, cmd.tripId, cmd.userId);
    const rows = await this.votes.listForTrip(cmd.tripId);
    return aggregate(rows, cmd.userId);
  }
}

/**
 * Group raw vote rows by `(targetType, targetId)` and compute
 * counts + score + the caller's own vote. O(n) over the vote
 * list — small enough that a naive two-map approach reads cleaner
 * than a SQL GROUP BY + a second query for `mine`.
 */
function aggregate(
  rows: readonly {
    readonly targetType: string;
    readonly targetId: string;
    readonly userId: string;
    readonly value: number;
  }[],
  callerUserId: string,
): VoteTally[] {
  interface Bucket {
    targetType: VoteTargetType;
    targetId: string;
    up: number;
    meh: number;
    down: number;
    mine: VoteValue | null;
  }
  const byKey = new Map<string, Bucket>();
  for (const r of rows) {
    const key = `${r.targetType}:${r.targetId}`;
    let b = byKey.get(key);
    if (!b) {
      b = {
        targetType: r.targetType as VoteTargetType,
        targetId: r.targetId,
        up: 0,
        meh: 0,
        down: 0,
        mine: null,
      };
      byKey.set(key, b);
    }
    if (r.value === 1) b.up++;
    else if (r.value === 0) b.meh++;
    else if (r.value === -1) b.down++;
    if (r.userId === callerUserId) b.mine = r.value as VoteValue;
  }
  return [...byKey.values()].map((b) => ({
    targetType: b.targetType,
    targetId: b.targetId,
    up: b.up,
    meh: b.meh,
    down: b.down,
    score: b.up - b.down,
    mine: b.mine,
  }));
}
