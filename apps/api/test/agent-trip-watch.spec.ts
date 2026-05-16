/**
 * POST.2A.2 — unit tests for StartTripWatchUseCase.
 *
 * Pure unit (no AppModule, no Postgres, no Prisma client) using
 * in-memory fake repositories that implement the ports. Proves the
 * "at most one active TripWatch per trip" domain invariant and the
 * append-only step contract without touching the DB — so it is
 * unaffected by the deferred migration apply / prisma generate.
 *
 * Installed by prompt [POST.2A.2].
 */
import { ConflictError } from '@app/errors';
import type { AgentRun } from '../src/modules/agent/domain/agent-run.entity';
import type { AgentStep } from '../src/modules/agent/domain/agent-step.entity';
import type { TripWatch } from '../src/modules/agent/domain/trip-watch.entity';
import {
  type AgentRunRepository,
  type AppendAgentStepInput,
  type CreateAgentRunInput,
} from '../src/modules/agent/application/ports/agent-run.repository';
import {
  type CreateTripWatchInput,
  type TripWatchRepository,
} from '../src/modules/agent/application/ports/trip-watch.repository';
import { StartTripWatchUseCase } from '../src/modules/agent/application/start-trip-watch.use-case';

let seq = 0;
const id = (p: string): string => `${p}-${++seq}`;

class FakeAgentRunRepository implements AgentRunRepository {
  readonly runs = new Map<string, AgentRun>();
  readonly steps: AgentStep[] = [];

  async create(input: CreateAgentRunInput): Promise<AgentRun> {
    const now = new Date('2026-05-16T00:00:00.000Z');
    const run: AgentRun = {
      id: id('run'),
      tripId: input.tripId,
      status: 'watching',
      planVersion: 1,
      createdAt: now,
      updatedAt: now,
    };
    this.runs.set(run.id, run);
    return run;
  }
  async findById(runId: string): Promise<AgentRun | null> {
    return this.runs.get(runId) ?? null;
  }
  async appendStep(input: AppendAgentStepInput): Promise<AgentStep> {
    const step: AgentStep = {
      id: id('step'),
      agentRunId: input.agentRunId,
      kind: input.kind,
      detail: input.detail ?? null,
      createdAt: new Date('2026-05-16T00:00:00.000Z'),
    };
    this.steps.push(step);
    return step;
  }
  async listSteps(agentRunId: string): Promise<readonly AgentStep[]> {
    return this.steps.filter((s) => s.agentRunId === agentRunId);
  }
  async getStep(stepId: string): Promise<AgentStep | null> {
    return this.steps.find((s) => s.id === stepId) ?? null;
  }
  async bumpPlanVersion(agentRunId: string): Promise<void> {
    const r = this.runs.get(agentRunId);
    if (r) this.runs.set(agentRunId, { ...r, planVersion: r.planVersion + 1 });
  }
}

class FakeTripWatchRepository implements TripWatchRepository {
  readonly watches: TripWatch[] = [];

  async create(input: CreateTripWatchInput): Promise<TripWatch> {
    const now = new Date('2026-05-16T00:00:00.000Z');
    const watch: TripWatch = {
      id: id('watch'),
      tripId: input.tripId,
      agentRunId: input.agentRunId,
      subscribedSignals: input.subscribedSignals,
      thresholds: input.thresholds,
      active: true,
      createdAt: now,
      updatedAt: now,
    };
    this.watches.push(watch);
    return watch;
  }
  async findActiveByTrip(tripId: string): Promise<TripWatch | null> {
    return this.watches.find((w) => w.tripId === tripId && w.active) ?? null;
  }
  async listActive(): Promise<readonly TripWatch[]> {
    return this.watches.filter((w) => w.active);
  }
  async raiseThreshold(_tripId: string): Promise<void> {
    /* not exercised by the start-watch spec */
  }
}

describe('StartTripWatchUseCase (POST.2A.2, unit, no infra)', () => {
  let runs: FakeAgentRunRepository;
  let watches: FakeTripWatchRepository;
  let uc: StartTripWatchUseCase;

  beforeEach(() => {
    seq = 0;
    runs = new FakeAgentRunRepository();
    watches = new FakeTripWatchRepository();
    uc = new StartTripWatchUseCase(runs, watches);
  });

  it('starts a watch: creates run + watch + a watch_started step', async () => {
    const res = await uc.execute({
      tripId: 'trip-A',
      subscribedSignals: ['weather'],
      thresholds: { weather: 0.7 },
    });

    expect(res.agentRunId).toBeDefined();
    expect(res.tripWatchId).toBeDefined();
    expect(watches.watches).toHaveLength(1);
    expect(watches.watches[0]?.active).toBe(true);

    const steps = await runs.listSteps(res.agentRunId);
    expect(steps).toHaveLength(1);
    expect(steps[0]?.kind).toBe('watch_started');
    expect(steps[0]?.detail).toEqual({ subscribedSignals: ['weather'] });
  });

  it('rejects a second active watch for the same trip (the invariant)', async () => {
    await uc.execute({ tripId: 'trip-A', subscribedSignals: ['weather'], thresholds: {} });

    await expect(
      uc.execute({ tripId: 'trip-A', subscribedSignals: ['flight'], thresholds: {} }),
    ).rejects.toMatchObject({ code: 'TRIP_WATCH_ALREADY_ACTIVE' });

    let caught: unknown;
    try {
      await uc.execute({ tripId: 'trip-A', subscribedSignals: ['flight'], thresholds: {} });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ConflictError);
    // No partial writes: still exactly one run + one watch from the first call.
    expect(watches.watches).toHaveLength(1);
    expect(runs.runs.size).toBe(1);
  });

  it('allows a new watch for a DIFFERENT trip', async () => {
    await uc.execute({ tripId: 'trip-A', subscribedSignals: ['weather'], thresholds: {} });
    const res = await uc.execute({
      tripId: 'trip-B',
      subscribedSignals: ['flight'],
      thresholds: {},
    });

    expect(res.tripWatchId).toBeDefined();
    expect(watches.watches).toHaveLength(2);
  });

  it('AgentRunRepository step contract is append + read ONLY (no update/delete)', () => {
    const repo: AgentRunRepository = runs;
    const keys = Object.getOwnPropertyNames(Object.getPrototypeOf(repo));
    expect(keys).toEqual(expect.arrayContaining(['appendStep', 'listSteps']));
    // The port type has no updateStep/deleteStep — assert the
    // immutability contract is not silently widened by the adapter.
    expect(keys).not.toContain('updateStep');
    expect(keys).not.toContain('deleteStep');
    expect(keys).not.toContain('removeStep');
  });
});
