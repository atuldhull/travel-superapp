/**
 * Cast (or change) a vote on a trip item. Authorization:
 *
 *   - Caller must own the trip, OR
 *   - Trip must have at least one active (publicRead=true,
 *     non-expired) TripShare — i.e. the owner has published it
 *     for collaboration. Anyone authed can then vote.
 *
 * The "active-share-opens-voting" gate is v1's lightweight
 * collaboration primitive. It intentionally doesn't require the
 * caller to prove they've seen the share code — any authed user
 * can vote once the owner has published. Stronger binding (vote
 * only if you resolved this specific share) is a future slice
 * with a TripShareResolution ledger.
 *
 * Idempotent: upsert by the UNIQUE (tripId, userId, targetType,
 * targetId) compound key. Recasting (`+1` → `-1`) updates the
 * existing row rather than creating a new one.
 *
 * Installed by prompt [IV.18.12.3].
 */
import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '@app/errors';
import { TRIP_REPOSITORY, type TripRepository } from '../../trip/application/ports/trip.repository';
import {
  TRIP_SHARE_REPOSITORY,
  type TripShareRepository,
} from '../../trip/application/ports/trip-share.repository';
import type { Vote, VoteTargetType, VoteValue } from '../domain/vote.entity';
import { VOTE_REPOSITORY, type VoteRepository } from './ports/vote.repository';
import { BLOCK_REPOSITORY, type BlockRepository } from './ports/block.repository';
import { assertNotBlocked } from './block-user.use-case';

export interface CastVoteCommand {
  readonly tripId: string;
  readonly userId: string;
  readonly targetType: VoteTargetType;
  readonly targetId: string;
  readonly value: VoteValue;
}

@Injectable()
export class CastVoteUseCase {
  constructor(
    @Inject(VOTE_REPOSITORY) private readonly votes: VoteRepository,
    @Inject(TRIP_REPOSITORY) private readonly trips: TripRepository,
    @Inject(TRIP_SHARE_REPOSITORY) private readonly shares: TripShareRepository,
    @Inject(BLOCK_REPOSITORY) private readonly blocks: BlockRepository,
  ) {}

  async execute(cmd: CastVoteCommand): Promise<Vote> {
    await assertCanVote(this.trips, this.shares, cmd.tripId, cmd.userId);
    // POST.2B.1 — a block in either direction between the voter and
    // the trip owner refuses the interaction (alongside the existing
    // access gate, not a new layer).
    const trip = await this.trips.findById(cmd.tripId);
    if (trip && trip.userId !== cmd.userId) {
      await assertNotBlocked(this.blocks, cmd.userId, trip.userId);
    }
    return this.votes.upsert({
      tripId: cmd.tripId,
      userId: cmd.userId,
      targetType: cmd.targetType,
      targetId: cmd.targetId,
      value: cmd.value,
    });
  }
}

/**
 * Gate used by every Social write/read use-case. Split out so the
 * three use-cases stay thin + the gate's single source of truth
 * is easy to audit.
 */
export async function assertCanVote(
  trips: TripRepository,
  shares: TripShareRepository,
  tripId: string,
  userId: string,
): Promise<void> {
  const ownTrip = await trips.findByIdForUser(tripId, userId);
  if (ownTrip) return;
  const activeShares = await shares.countActiveSharesForTrip(tripId);
  if (activeShares > 0) return;
  // Trip exists but the caller doesn't own it AND no active share
  // published → 404 to collapse owner/non-owner/missing into one
  // signal. Same IDOR-defence shape the Trip module uses.
  throw new NotFoundError(`Trip not found: ${tripId}`, { tripId }, 'TRIP_NOT_FOUND');
}
