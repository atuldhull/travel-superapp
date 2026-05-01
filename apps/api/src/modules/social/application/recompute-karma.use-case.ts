/**
 * V.UX.25 — nightly recompute over every active reviewer. The
 * cast-helpful-vote use-case already recomputes the affected
 * author inline, so this is a safety-net sweep that:
 *
 *   - Upserts a karma row for any user who became active since
 *     the last tick (e.g. wrote their first review).
 *   - Reconciles drift (a HelpfulVote that failed its inline
 *     recompute due to a transient DB blip).
 *
 * Returns counts for telemetry. The runner (a small
 * `setInterval` scheduler in `interface/`) logs them.
 *
 * Installed by prompt [V.UX.25].
 */
import { Inject, Injectable } from '@nestjs/common';
import { KARMA_REPOSITORY, type KarmaRepository } from './ports/karma.repository';

export interface RecomputeKarmaSweepResult {
  readonly visited: number;
  readonly changed: number;
}

@Injectable()
export class RecomputeKarmaUseCase {
  constructor(@Inject(KARMA_REPOSITORY) private readonly karma: KarmaRepository) {}

  async execute(): Promise<RecomputeKarmaSweepResult> {
    const userIds = await this.karma.listActiveReviewerUserIds();
    let changed = 0;
    for (const userId of userIds) {
      // Sequential — the active set is small + the per-user work
      // is two indexed counts + one upsert. Parallelising here would
      // hit Postgres `max_connections=100` faster than it'd help.
      const result = await this.karma.recomputeForUser(userId);
      if (result.changed) changed++;
    }
    return { visited: userIds.length, changed };
  }
}
