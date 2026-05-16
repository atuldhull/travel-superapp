/**
 * POST.2A.2 — port for AgentRun persistence + its append-only step log.
 *
 * LAW 3 / append-only: this port exposes `appendStep` + `listSteps`
 * ONLY. There is deliberately no `updateStep` / `deleteStep` — the
 * audit log is immutable by type, not by convention. Bound to a
 * Prisma adapter when the DB is unblocked (deferred from POST.2A.2).
 *
 * Installed by prompt [POST.2A.2].
 */
import type { AgentRun } from '../../domain/agent-run.entity';
import type { AgentStep, AgentStepKind } from '../../domain/agent-step.entity';

export interface CreateAgentRunInput {
  readonly tripId: string;
}

export interface AppendAgentStepInput {
  readonly agentRunId: string;
  readonly kind: AgentStepKind;
  readonly detail?: Readonly<Record<string, unknown>> | null;
}

export interface AgentRunRepository {
  create(input: CreateAgentRunInput): Promise<AgentRun>;
  findById(id: string): Promise<AgentRun | null>;
  /** Append-only — the only write verb for steps. */
  appendStep(input: AppendAgentStepInput): Promise<AgentStep>;
  listSteps(agentRunId: string): Promise<readonly AgentStep[]>;
}

export const AGENT_RUN_REPOSITORY = Symbol('AgentRunRepository');
