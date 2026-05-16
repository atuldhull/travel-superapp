/**
 * POST.2A.4 — propose a re-plan (the SAFE boundary).
 *
 * Drafts a re-plan via the existing planner tool, records it as an
 * append-only `proposal` AgentStep, and emits `Trip.ReplanProposed`
 * (the notifications handler turns it into a push). It does **NOT**
 * mutate the trip and has **NO** money-moving authority — there is
 * deliberately no trip / itinerary / money-related dependency
 * injected here, so acting autonomously is structurally impossible
 * (LAW 2).
 *
 * Trip context is passed IN (the scheduler↔trip glue that supplies
 * real context is the deferred integration seam — same as 2A.3).
 *
 * Installed by prompt [POST.2A.4].
 */
import { Inject, Injectable } from '@nestjs/common';
import { EVENT_BUS, type EventBus } from '@app/events';
import { createLogger, type AppLogger } from '@app/logger';
import type { PlanDiff } from '../domain/plan-diff.vo';
import { makeAgentEvent, type ReplanProposedEvent } from '../domain/agent.events';
import { AGENT_RUN_REPOSITORY, type AgentRunRepository } from './ports/agent-run.repository';
import { PLAN_TOOL_PORT, type PlanTool, type PlanTripContext } from './ports/plan-tool.port';

export interface ProposeReplanCommand {
  readonly agentRunId: string;
  readonly tripId: string;
  /** Trip owner — who the proposal notification goes to. */
  readonly ownerId: string;
  readonly trip: PlanTripContext;
  readonly diffs: readonly PlanDiff[];
  readonly reason: string;
}

export interface ProposeReplanResult {
  readonly proposalId: string;
  readonly summary: string;
  readonly provider: string;
}

@Injectable()
export class ProposeReplanUseCase {
  private readonly logger: AppLogger = createLogger('agent.propose-replan');

  constructor(
    @Inject(PLAN_TOOL_PORT) private readonly planTool: PlanTool,
    @Inject(AGENT_RUN_REPOSITORY) private readonly runs: AgentRunRepository,
    @Inject(EVENT_BUS) private readonly events: EventBus,
  ) {}

  async execute(cmd: ProposeReplanCommand): Promise<ProposeReplanResult> {
    const draft = await this.planTool.draftReplan({ trip: cmd.trip, reason: cmd.reason });

    const step = await this.runs.appendStep({
      agentRunId: cmd.agentRunId,
      kind: 'proposal',
      detail: {
        diffs: cmd.diffs,
        summary: draft.summary,
        provider: draft.provider,
        reason: cmd.reason,
        status: 'pending',
      },
    });

    const evt: ReplanProposedEvent = makeAgentEvent('Trip.ReplanProposed', {
      proposalId: step.id,
      agentRunId: cmd.agentRunId,
      tripId: cmd.tripId,
      ownerId: cmd.ownerId,
      summary: draft.summary,
      reason: cmd.reason,
    });
    await this.events.publish(evt);

    this.logger.info(
      { agentRunId: cmd.agentRunId, tripId: cmd.tripId, proposalId: step.id },
      'replan_proposed',
    );
    return { proposalId: step.id, summary: draft.summary, provider: draft.provider };
  }
}
