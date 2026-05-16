/**
 * POST.2A.4 — confirm (accept/decline) a proposed re-plan.
 *
 * The human-in-the-loop gate. ACCEPT records an append-only
 * `accepted` step + bumps the run's plan version. DECLINE records a
 * `declined` step + raises the watch threshold so the agent stops
 * re-proposing the same thing. Neither path can move money or
 * reserve anything (LAW 2) — no such dependency exists here.
 *
 * Scope note: physically rewriting the trip's itinerary on accept
 * needs the trip module's ITINERARY_REPOSITORY.replaceDays — that
 * agent↔trip mutation glue is the deferred integration seam (same
 * as 2A.3 coords). This use-case records the human decision + run
 * state; it never auto-applies.
 *
 * Installed by prompt [POST.2A.4].
 */
import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '@app/errors';
import { createLogger, type AppLogger } from '@app/logger';
import { AGENT_RUN_REPOSITORY, type AgentRunRepository } from './ports/agent-run.repository';
import { TRIP_WATCH_REPOSITORY, type TripWatchRepository } from './ports/trip-watch.repository';

export type ReplanDecision = 'accept' | 'decline';

export interface ConfirmReplanCommand {
  readonly proposalId: string;
  readonly decision: ReplanDecision;
  /** The authenticated user taking the action (audited). */
  readonly userId: string;
}

export interface ConfirmReplanResult {
  readonly status: 'accepted' | 'declined';
  readonly agentRunId: string;
}

@Injectable()
export class ConfirmReplanUseCase {
  private readonly logger: AppLogger = createLogger('agent.confirm-replan');

  constructor(
    @Inject(AGENT_RUN_REPOSITORY) private readonly runs: AgentRunRepository,
    @Inject(TRIP_WATCH_REPOSITORY) private readonly watches: TripWatchRepository,
  ) {}

  async execute(cmd: ConfirmReplanCommand): Promise<ConfirmReplanResult> {
    const step = await this.runs.getStep(cmd.proposalId);
    if (!step || step.kind !== 'proposal') {
      throw new NotFoundError(
        'Agent proposal not found',
        { proposalId: cmd.proposalId },
        'AGENT_PROPOSAL_NOT_FOUND',
      );
    }
    const run = await this.runs.findById(step.agentRunId);
    if (!run) {
      throw new NotFoundError(
        'Agent run not found',
        { agentRunId: step.agentRunId },
        'AGENT_RUN_NOT_FOUND',
      );
    }

    if (cmd.decision === 'accept') {
      await this.runs.appendStep({
        agentRunId: run.id,
        kind: 'accepted',
        detail: { proposalId: cmd.proposalId, by: cmd.userId },
      });
      await this.runs.bumpPlanVersion(run.id);
      this.logger.info({ agentRunId: run.id, proposalId: cmd.proposalId }, 'replan_accepted');
      return { status: 'accepted', agentRunId: run.id };
    }

    await this.runs.appendStep({
      agentRunId: run.id,
      kind: 'declined',
      detail: { proposalId: cmd.proposalId, by: cmd.userId },
    });
    await this.watches.raiseThreshold(run.tripId);
    this.logger.info({ agentRunId: run.id, proposalId: cmd.proposalId }, 'replan_declined');
    return { status: 'declined', agentRunId: run.id };
  }
}
