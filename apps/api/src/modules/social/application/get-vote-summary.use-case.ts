/**
 * Aggregate every vote on a (targetType, targetId) across all
 * trips into `{ up, meh, down, score }`. Drives the vote-count
 * widget on every screen that renders a votable target —
 * itinerary items today, places + restaurants when those become
 * votable in follow-up slices.
 *
 * Empty target → `{ up: 0, meh: 0, down: 0, score: 0 }` — NOT a
 * 404. Same precedent as the review summary endpoint
 * (`[IV.18.12.8]`): public aggregation surfaces don't 404 on
 * empty, both because zero-count is a valid signal and because
 * 404-on-empty would leak target-existence to strangers.
 *
 * `@Public()` — vote counts are crowd signal, no PII (no
 * per-user vote disclosure, just buckets).
 *
 * Installed by prompt [IV.18.12.9].
 */
import { Inject, Injectable } from '@nestjs/common';
import type { VoteTargetType } from '../domain/vote.entity';
import { VOTE_REPOSITORY, type VoteRepository, type VoteSummary } from './ports/vote.repository';

export interface GetVoteSummaryCommand {
  readonly targetType: VoteTargetType;
  readonly targetId: string;
}

@Injectable()
export class GetVoteSummaryUseCase {
  constructor(@Inject(VOTE_REPOSITORY) private readonly votes: VoteRepository) {}

  async execute(cmd: GetVoteSummaryCommand): Promise<VoteSummary> {
    return this.votes.aggregateByTarget(cmd.targetType, cmd.targetId);
  }
}
