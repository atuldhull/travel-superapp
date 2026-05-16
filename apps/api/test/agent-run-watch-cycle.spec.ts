/**
 * Agent↔trip real triggers — RunWatchCycleUseCase (pure/fake, no
 * Redis, no interval, no DB, ZERO keys → LAW 1).
 *
 * Proves the keystone wiring every Phase-A/C prompt deferred:
 *   - trip ENDED → the 2C.1 seam fires: PRIVATE Memory Book drafted
 *     + watch deactivated + run closed (idempotent draft honored)
 *   - orphan trip (deleted) → watch drained, no draft/propose
 *   - active + no resolved center → graceful skip (no crash)
 *   - active + MATERIAL weather change → ProposeReplanUseCase called
 *     with the resolved trip context; signal persisted
 *   - active + sub-threshold OR already-over-threshold (debounce via
 *     the persisted previous snapshot) → NO proposal
 *
 * Uses the REAL pure EvaluateSignalsUseCase (no deps) so the
 * threshold/debounce logic is exercised end-to-end.
 *
 * Installed by the agent↔trip real-triggers slice.
 */
import { EvaluateSignalsUseCase } from '../src/modules/agent/application/evaluate-signals.use-case';
import { RunWatchCycleUseCase } from '../src/modules/agent/application/run-watch-cycle.use-case';
import type { TripWatch } from '../src/modules/agent/domain/trip-watch.entity';
import type { AgentStep } from '../src/modules/agent/domain/agent-step.entity';
import type {
  SignalSnapshot,
  SignalSource,
} from '../src/modules/agent/application/ports/signal-source.port';
import type { AgentRunRepository } from '../src/modules/agent/application/ports/agent-run.repository';
import type { TripWatchRepository } from '../src/modules/agent/application/ports/trip-watch.repository';
import type { TripRepository } from '../src/modules/trip/application/ports/trip.repository';
import type { Trip } from '../src/modules/trip/domain/trip.entity';
import type { GeoQueries } from '../src/common/db/geo-queries';
import type { ProposeReplanUseCase } from '../src/modules/agent/application/propose-replan.use-case';
import type { DraftMemoryBookUseCase } from '../src/modules/agent/application/draft-memory-book.use-case';

const NOW = new Date('2026-05-16T12:00:00.000Z');
const YESTERDAY = new Date('2026-05-15T00:00:00.000Z');
const TOMORROW = new Date('2026-05-17T00:00:00.000Z');

function watch(over: Partial<TripWatch> = {}): TripWatch {
  return {
    id: 'w1',
    tripId: 't1',
    agentRunId: 'run1',
    subscribedSignals: ['weather'],
    thresholds: { weather: 0.7 },
    active: true,
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
  };
}

function trip(over: Partial<Trip> = {}): Trip {
  return {
    id: 't1',
    userId: 'owner1',
    title: 'Lisbon long weekend',
    status: 'published',
    radiusKm: 5,
    startsOn: YESTERDAY,
    endsOn: TOMORROW,
    version: 1,
    archivedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
  };
}

function tripsRepo(t: Trip | null): TripRepository {
  return { findById: async () => t } as unknown as TripRepository;
}
function geoRepo(center: { lat: number; lng: number } | null): GeoQueries {
  return { findTripCenter: async () => center } as unknown as GeoQueries;
}

interface Spies {
  draftCalls: unknown[];
  proposeCalls: unknown[];
  deactivated: string[];
  closed: string[];
  appended: Array<{ kind: string; detail: unknown }>;
}

function weatherSnap(precipPct: number | null): SignalSnapshot {
  return {
    kind: 'weather',
    observedAt: NOW,
    data: { maxPrecipProbabilityPercent: precipPct, worstDay: '2026-05-16' },
  };
}

function build(opts: {
  t: Trip | null;
  center?: { lat: number; lng: number } | null;
  steps?: AgentStep[];
  snapshot?: SignalSnapshot;
  alreadyDrafted?: boolean;
}): { uc: RunWatchCycleUseCase; spy: Spies } {
  const spy: Spies = {
    draftCalls: [],
    proposeCalls: [],
    deactivated: [],
    closed: [],
    appended: [],
  };
  const runs = {
    listSteps: async () => opts.steps ?? [],
    appendStep: async (i: { kind: string; detail: unknown }) => {
      spy.appended.push({ kind: i.kind, detail: i.detail });
      return { id: 's', agentRunId: 'run1', kind: i.kind, detail: null, createdAt: NOW };
    },
    markClosed: async (id: string) => {
      spy.closed.push(id);
    },
  } as unknown as AgentRunRepository;
  const watches = {
    deactivate: async (tripId: string) => {
      spy.deactivated.push(tripId);
    },
  } as unknown as TripWatchRepository;
  const signals: SignalSource = {
    snapshot: async () => opts.snapshot ?? weatherSnap(0),
  };
  const propose = {
    execute: async (cmd: unknown) => {
      spy.proposeCalls.push(cmd);
      return { proposalId: 'p1', summary: 's', provider: 'stub' };
    },
  } as unknown as ProposeReplanUseCase;
  const draft = {
    execute: async (cmd: unknown) => {
      spy.draftCalls.push(cmd);
      return { memoryBookId: 'mb1', alreadyDrafted: opts.alreadyDrafted ?? false };
    },
  } as unknown as DraftMemoryBookUseCase;

  const uc = new RunWatchCycleUseCase(
    tripsRepo(opts.t),
    geoRepo(opts.center === undefined ? { lat: 38.7, lng: -9.1 } : opts.center),
    signals,
    new EvaluateSignalsUseCase(),
    propose,
    draft,
    runs,
    watches,
  );
  return { uc, spy };
}

describe('RunWatchCycleUseCase — trip-end seam (the 2C.1 payoff fires)', () => {
  it('ended trip → drafts PRIVATE book + deactivates watch + closes run', async () => {
    const { uc, spy } = build({ t: trip({ endsOn: YESTERDAY }) });
    const res = await uc.execute(watch(), NOW);
    expect(res).toEqual({ outcome: 'closed', memoryBookId: 'mb1', alreadyDrafted: false });
    expect(spy.draftCalls).toEqual([
      { agentRunId: 'run1', tripId: 't1', ownerId: 'owner1', title: 'Lisbon long weekend' },
    ]);
    expect(spy.deactivated).toEqual(['t1']);
    expect(spy.closed).toEqual(['run1']);
    expect(spy.proposeCalls).toHaveLength(0);
  });

  it('ended trip, draft idempotent (alreadyDrafted) → still deactivates + closes', async () => {
    const { uc, spy } = build({ t: trip({ endsOn: YESTERDAY }), alreadyDrafted: true });
    const res = await uc.execute(watch(), NOW);
    expect(res).toMatchObject({ outcome: 'closed', alreadyDrafted: true });
    expect(spy.deactivated).toEqual(['t1']);
    expect(spy.closed).toEqual(['run1']);
  });
});

describe('RunWatchCycleUseCase — guards', () => {
  it('orphan trip (deleted) → drains the watch, no draft/propose', async () => {
    const { uc, spy } = build({ t: null });
    const res = await uc.execute(watch(), NOW);
    expect(res).toEqual({ outcome: 'orphan' });
    expect(spy.deactivated).toEqual(['t1']);
    expect(spy.draftCalls).toHaveLength(0);
    expect(spy.proposeCalls).toHaveLength(0);
  });

  it('active, no resolved center yet → graceful skip (no crash, no propose)', async () => {
    const { uc, spy } = build({ t: trip(), center: null });
    const res = await uc.execute(watch(), NOW);
    expect(res).toEqual({ outcome: 'no-center' });
    expect(spy.proposeCalls).toHaveLength(0);
    expect(spy.deactivated).toHaveLength(0);
  });
});

describe('RunWatchCycleUseCase — signal → propose', () => {
  it('material weather change → proposes with the resolved trip context', async () => {
    const { uc, spy } = build({ t: trip(), snapshot: weatherSnap(90) }); // 0.9 ≥ 0.7
    const res = await uc.execute(watch(), NOW);
    expect(res).toEqual({ outcome: 'proposed', kind: 'weather' });
    expect(spy.proposeCalls).toHaveLength(1);
    expect(spy.proposeCalls[0]).toMatchObject({
      agentRunId: 'run1',
      tripId: 't1',
      ownerId: 'owner1',
      trip: { title: 'Lisbon long weekend', lat: 38.7, lng: -9.1, radiusKm: 5 },
    });
    // the snapshot was persisted as an append-only signal_seen step
    expect(spy.appended.some((a) => a.kind === 'signal_seen')).toBe(true);
  });

  it('sub-threshold weather → persists snapshot, NO proposal', async () => {
    const { uc, spy } = build({ t: trip(), snapshot: weatherSnap(10) }); // 0.1 < 0.7
    const res = await uc.execute(watch(), NOW);
    expect(res).toEqual({ outcome: 'no-change' });
    expect(spy.proposeCalls).toHaveLength(0);
    expect(spy.appended.some((a) => a.kind === 'signal_seen')).toBe(true);
  });

  it('debounce: previous snapshot already over threshold → NO re-propose', async () => {
    const priorStep: AgentStep = {
      id: 'prev',
      agentRunId: 'run1',
      kind: 'signal_seen',
      detail: {
        kind: 'weather',
        snapshot: {
          kind: 'weather',
          observedAt: YESTERDAY.toISOString(),
          data: { maxPrecipProbabilityPercent: 95, worstDay: '2026-05-16' },
        },
      },
      createdAt: YESTERDAY,
    };
    const { uc, spy } = build({ t: trip(), steps: [priorStep], snapshot: weatherSnap(96) });
    const res = await uc.execute(watch(), NOW);
    // before=0.95 ≥ threshold AND now=0.96 ≥ threshold → debounced.
    expect(res).toEqual({ outcome: 'no-change' });
    expect(spy.proposeCalls).toHaveLength(0);
  });
});
