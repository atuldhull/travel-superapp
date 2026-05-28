/**
 * [S-C2] List pending agent proposals for a trip.
 *
 * The AgentWatchCard (apps/web) calls this on every render of /trips/[id]
 * to discover whether the trip-watch agent has open proposals for the
 * user to accept / decline. Returns the active run + the *pending*
 * proposal steps (kind='proposal' AND not followed by an accepted /
 * declined step that references the proposal id).
 *
 * Returns `{ run: null, proposals: [] }` when the trip has no active
 * watch — the UI renders the "watching" empty state in that case.
 *
 * Installed by [S-C2] of the S-series real-functionality closeout.
 */
import { Inject, Injectable } from '@nestjs/common';
import type { AgentRun } from '../domain/agent-run.entity';
import type { AgentStep } from '../domain/agent-step.entity';
import { AGENT_RUN_REPOSITORY, type AgentRunRepository } from './ports/agent-run.repository';

export interface ListTripProposalsResult {
  /** Active agent run for the trip, or null when none is watching. */
  readonly run: AgentRun | null;
  /** Open proposals (kind='proposal' AND not yet resolved). */
  readonly proposals: readonly AgentStep[];
}

@Injectable()
export class ListTripProposalsUseCase {
  constructor(
    @Inject(AGENT_RUN_REPOSITORY)
    private readonly runs: AgentRunRepository,
  ) {}

  async execute(tripId: string): Promise<ListTripProposalsResult> {
    const run = await this.runs.findActiveByTripId(tripId);
    if (run === null) return { run: null, proposals: [] };

    const steps = await this.runs.listSteps(run.id);
    // A proposal is "pending" iff it's not followed by an accepted /
    // declined step. The accept / decline step's `detail.proposalId`
    // points at the proposal step's id.
    const resolved = new Set<string>();
    for (const step of steps) {
      if (step.kind === 'accepted' || step.kind === 'declined') {
        const pid = (step.detail as { proposalId?: unknown } | null)?.proposalId;
        if (typeof pid === 'string') resolved.add(pid);
      }
    }
    const proposals = steps.filter((step) => step.kind === 'proposal' && !resolved.has(step.id));
    return { run, proposals };
  }
}
