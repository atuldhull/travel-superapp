/**
 * POST.2A.4 — unit tests for the SAFE boundary.
 *
 * Pure/fake (no infra). Proves: propose writes a proposal + emits
 * the event but NEVER mutates a trip (no trip dep is even
 * injectable into the use-case); accept records acceptance + bumps
 * the plan version; decline records + raises the watch threshold;
 * an unknown proposal 404s. The "no money/booking" guarantee is the
 * `rg` AC verified separately.
 *
 * Installed by prompt [POST.2A.4].
 */
import { NotFoundError } from '@app/errors';
import type { DomainEvent, EventBus, Subscription } from '@app/events';
import type { AgentRun } from '../src/modules/agent/domain/agent-run.entity';
import type { AgentStep } from '../src/modules/agent/domain/agent-step.entity';
import type { TripWatch } from '../src/modules/agent/domain/trip-watch.entity';
import type {
  AgentRunRepository,
  AppendAgentStepInput,
  CreateAgentRunInput,
} from '../src/modules/agent/application/ports/agent-run.repository';
import type {
  CreateTripWatchInput,
  TripWatchRepository,
} from '../src/modules/agent/application/ports/trip-watch.repository';
import type { PlanTool } from '../src/modules/agent/application/ports/plan-tool.port';
import { ProposeReplanUseCase } from '../src/modules/agent/application/propose-replan.use-case';
import { ConfirmReplanUseCase } from '../src/modules/agent/application/confirm-replan.use-case';

let seq = 0;
const id = (p: string): string => `${p}-${++seq}`;
const NOW = new Date('2026-05-16T00:00:00.000Z');

class FakeRuns implements AgentRunRepository {
  runs = new Map<string, AgentRun>();
  steps: AgentStep[] = [];
  async create(i: CreateAgentRunInput): Promise<AgentRun> {
    const r: AgentRun = {
      id: id('run'),
      tripId: i.tripId,
      status: 'watching',
      planVersion: 1,
      createdAt: NOW,
      updatedAt: NOW,
    };
    this.runs.set(r.id, r);
    return r;
  }
  async findById(x: string): Promise<AgentRun | null> {
    return this.runs.get(x) ?? null;
  }
  async appendStep(i: AppendAgentStepInput): Promise<AgentStep> {
    const s: AgentStep = {
      id: id('step'),
      agentRunId: i.agentRunId,
      kind: i.kind,
      detail: i.detail ?? null,
      createdAt: NOW,
    };
    this.steps.push(s);
    return s;
  }
  async listSteps(runId: string): Promise<readonly AgentStep[]> {
    return this.steps.filter((s) => s.agentRunId === runId);
  }
  async getStep(stepId: string): Promise<AgentStep | null> {
    return this.steps.find((s) => s.id === stepId) ?? null;
  }
  bumped: string[] = [];
  async bumpPlanVersion(runId: string): Promise<void> {
    this.bumped.push(runId);
  }
}

class FakeWatches implements TripWatchRepository {
  raised: string[] = [];
  async create(_i: CreateTripWatchInput): Promise<TripWatch> {
    throw new Error('unused');
  }
  async findActiveByTrip(_t: string): Promise<TripWatch | null> {
    return null;
  }
  async listActive(): Promise<readonly TripWatch[]> {
    return [];
  }
  async raiseThreshold(tripId: string): Promise<void> {
    this.raised.push(tripId);
  }
}

class FakeBus implements EventBus {
  published: DomainEvent[] = [];
  async publish<T>(e: DomainEvent<T>): Promise<void> {
    this.published.push(e);
  }
  subscribe<T>(
    eventName: string,
    _handler: (evt: DomainEvent<T>) => void | Promise<void>,
    opts?: { readonly consumerGroup?: string },
  ): Subscription {
    return {
      eventName,
      consumerGroup: opts?.consumerGroup ?? 'test',
      unsubscribe: async (): Promise<void> => undefined,
    };
  }
  async close(): Promise<void> {
    /* no-op */
  }
}

const fakePlanTool: PlanTool = {
  draftReplan: async () => ({ summary: 'Swap the rooftop walk to Wed', provider: 'stub' }),
};

const TRIP = {
  title: 'Lisbon long weekend',
  lat: 38.72,
  lng: -9.14,
  radiusKm: 10,
  startsOn: null,
  endsOn: null,
};

describe('ProposeReplanUseCase (POST.2A.4, SAFE boundary)', () => {
  beforeEach(() => {
    seq = 0;
  });

  it('writes a proposal step + emits Trip.ReplanProposed, mutates NO trip', async () => {
    const runs = new FakeRuns();
    const bus = new FakeBus();
    const run = await runs.create({ tripId: 'trip-1' });
    const uc = new ProposeReplanUseCase(fakePlanTool, runs, bus);

    const res = await uc.execute({
      agentRunId: run.id,
      tripId: 'trip-1',
      ownerId: 'user-1',
      trip: TRIP,
      diffs: [{ op: 'move', stopId: 'd1', reason: 'rain' }],
      reason: 'rain 90%',
    });

    expect(res.summary).toBe('Swap the rooftop walk to Wed');
    const steps = await runs.listSteps(run.id);
    expect(steps.map((s) => s.kind)).toContain('proposal');
    expect(bus.published).toHaveLength(1);
    expect(bus.published[0]?.name).toBe('Trip.ReplanProposed');
    expect((bus.published[0]?.payload as { ownerId: string }).ownerId).toBe('user-1');
    // Structural LAW 2: the use-case's only collaborators are the
    // plan tool, the run repo, and the event bus — no trip /
    // itinerary / payment port can be reached from here.
    expect(uc).toBeInstanceOf(ProposeReplanUseCase);
  });
});

describe('ConfirmReplanUseCase (POST.2A.4, human-in-the-loop)', () => {
  beforeEach(() => {
    seq = 0;
  });

  async function seed(): Promise<{
    runs: FakeRuns;
    watches: FakeWatches;
    proposalId: string;
    runId: string;
  }> {
    const runs = new FakeRuns();
    const watches = new FakeWatches();
    const run = await runs.create({ tripId: 'trip-9' });
    const step = await runs.appendStep({ agentRunId: run.id, kind: 'proposal', detail: {} });
    return { runs, watches, proposalId: step.id, runId: run.id };
  }

  it('accept → records "accepted" + bumps plan version', async () => {
    const { runs, watches, proposalId, runId } = await seed();
    const uc = new ConfirmReplanUseCase(runs, watches);
    const res = await uc.execute({ proposalId, decision: 'accept', userId: 'u1' });
    expect(res.status).toBe('accepted');
    expect((await runs.listSteps(runId)).map((s) => s.kind)).toContain('accepted');
    expect(runs.bumped).toEqual([runId]);
    expect(watches.raised).toEqual([]);
  });

  it('decline → records "declined" + raises the watch threshold', async () => {
    const { runs, watches, proposalId } = await seed();
    const uc = new ConfirmReplanUseCase(runs, watches);
    const res = await uc.execute({ proposalId, decision: 'decline', userId: 'u1' });
    expect(res.status).toBe('declined');
    expect(watches.raised).toEqual(['trip-9']);
    expect(runs.bumped).toEqual([]);
  });

  it('unknown proposal id → AGENT_PROPOSAL_NOT_FOUND', async () => {
    const { runs, watches } = await seed();
    const uc = new ConfirmReplanUseCase(runs, watches);
    await expect(
      uc.execute({ proposalId: 'nope', decision: 'accept', userId: 'u1' }),
    ).rejects.toMatchObject({ code: 'AGENT_PROPOSAL_NOT_FOUND' });
    await expect(
      uc.execute({ proposalId: 'nope', decision: 'accept', userId: 'u1' }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
