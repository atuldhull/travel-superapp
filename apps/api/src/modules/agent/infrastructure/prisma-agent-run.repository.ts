/**
 * POST.2A.2 — Prisma adapter for AgentRunRepository.
 *
 * Implements the append + read ONLY step contract: there is no
 * update/delete path for AgentStep (immutable audit log). Maps
 * Prisma rows → domain entities via local `toDomain` helpers.
 *
 * Installed by prompt [POST.2A.2].
 */
import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AgentRun as PrismaAgentRun, AgentStep as PrismaAgentStep } from '@prisma/client';
import { PrismaService } from '../../../common/db/prisma.service';
import type { AgentRun, AgentRunStatus } from '../domain/agent-run.entity';
import type { AgentStep, AgentStepKind } from '../domain/agent-step.entity';
import type {
  AgentRunRepository,
  AppendAgentStepInput,
  CreateAgentRunInput,
} from '../application/ports/agent-run.repository';

function runToDomain(row: PrismaAgentRun): AgentRun {
  return {
    id: row.id,
    tripId: row.tripId,
    status: row.status as AgentRunStatus,
    planVersion: row.planVersion,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function stepToDomain(row: PrismaAgentStep): AgentStep {
  return {
    id: row.id,
    agentRunId: row.agentRunId,
    kind: row.kind as AgentStepKind,
    detail:
      row.detail === null || row.detail === undefined
        ? null
        : (row.detail as Readonly<Record<string, unknown>>),
    createdAt: row.createdAt,
  };
}

@Injectable()
export class PrismaAgentRunRepository implements AgentRunRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(input: CreateAgentRunInput): Promise<AgentRun> {
    const row = await this.prisma.agentRun.create({ data: { tripId: input.tripId } });
    return runToDomain(row);
  }

  async findById(id: string): Promise<AgentRun | null> {
    const row = await this.prisma.agentRun.findUnique({ where: { id } });
    return row ? runToDomain(row) : null;
  }

  async findActiveByTripId(tripId: string): Promise<AgentRun | null> {
    // [S-C2] Newest watching run for the trip. A trip can have multiple
    // runs over its lifetime (one per agent-watch session); we surface
    // the active one.
    const row = await this.prisma.agentRun.findFirst({
      where: { tripId, status: 'watching' },
      orderBy: { createdAt: 'desc' },
    });
    return row ? runToDomain(row) : null;
  }

  async appendStep(input: AppendAgentStepInput): Promise<AgentStep> {
    const row = await this.prisma.agentStep.create({
      data: {
        agentRunId: input.agentRunId,
        kind: input.kind,
        detail:
          input.detail === null || input.detail === undefined
            ? Prisma.JsonNull
            : (input.detail as Prisma.InputJsonValue),
      },
    });
    return stepToDomain(row);
  }

  async listSteps(agentRunId: string): Promise<readonly AgentStep[]> {
    const rows = await this.prisma.agentStep.findMany({
      where: { agentRunId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(stepToDomain);
  }

  async getStep(stepId: string): Promise<AgentStep | null> {
    const row = await this.prisma.agentStep.findUnique({ where: { id: stepId } });
    return row ? stepToDomain(row) : null;
  }

  async bumpPlanVersion(agentRunId: string): Promise<void> {
    await this.prisma.agentRun.update({
      where: { id: agentRunId },
      data: { planVersion: { increment: 1 } },
    });
  }

  async markClosed(agentRunId: string): Promise<void> {
    // Run STATE only — the append-only step log is never mutated.
    // Idempotent: re-closing an already-closed run is a no-op write.
    await this.prisma.agentRun.update({
      where: { id: agentRunId },
      data: { status: 'closed' },
    });
  }
}
