/**
 * Agent↔trip real triggers — one watched trip's per-tick cycle.
 *
 * This is the seam every Phase-A/C prompt deferred ("the scheduler↔
 * trip glue that supplies real context"). The scheduler stays a thin
 * cadence+lock shell; ALL the real wiring lives here and is fully
 * unit-testable with fakes (no Redis, no interval, no DB) — LAW 1.
 *
 * For one active TripWatch:
 *   1. Resolve REAL context: Trip (owner/title/dates/radius) via
 *      TripRepository, center lat/lng via GeoQueries (CLAUDE.md #11 —
 *      never read Trip.center directly).
 *   2. Orphan trip (deleted) → deactivate the watch, stop.
 *   3. Trip has DEFINITIVELY ENDED → the 2C.1 seam fires for real:
 *      draft the PRIVATE Memory Book (idempotent — never double-
 *      drafts), deactivate the watch, close the run. Nothing
 *      auto-publishes (LAW 2).
 *   4. Otherwise poll each subscribed signal, persist it as an
 *      append-only `signal_seen` step, run the PURE evaluator vs the
 *      previous snapshot, and on a MATERIAL change call
 *      ProposeReplanUseCase (propose-and-confirm only — the agent
 *      still never mutates the trip or spends; LAW 2). One proposal
 *      per cycle (no per-tick spam).
 *
 * No external call is made directly here; every dependency degrades
 * safely (weather offline → "no change"), so a tick can never throw.
 *
 * Installed by the agent↔trip real-triggers slice.
 */
import { Inject, Injectable } from '@nestjs/common';
import { createLogger, type AppLogger } from '@app/logger';
import { GeoQueries } from '../../../common/db/geo-queries';
import { TRIP_REPOSITORY, type TripRepository } from '../../trip';
import type { SignalKind, TripWatch } from '../domain/trip-watch.entity';
import type { AgentStep } from '../domain/agent-step.entity';
import type { SignalSnapshot } from './ports/signal-source.port';
import { SIGNAL_SOURCE_PORT, type SignalSource } from './ports/signal-source.port';
import { AGENT_RUN_REPOSITORY, type AgentRunRepository } from './ports/agent-run.repository';
import { TRIP_WATCH_REPOSITORY, type TripWatchRepository } from './ports/trip-watch.repository';
import { EvaluateSignalsUseCase } from './evaluate-signals.use-case';
import { ProposeReplanUseCase } from './propose-replan.use-case';
import { DraftMemoryBookUseCase } from './draft-memory-book.use-case';

/** Materiality gate used when a watch carries no threshold for a
 *  kind (0..1; weather = precip probability fraction). */
const DEFAULT_THRESHOLD = 0.7;

export type WatchCycleOutcome =
  | { readonly outcome: 'orphan' }
  | { readonly outcome: 'no-center' }
  | { readonly outcome: 'no-change' }
  | { readonly outcome: 'closed'; readonly memoryBookId: string; readonly alreadyDrafted: boolean }
  | { readonly outcome: 'proposed'; readonly kind: SignalKind };

function hydrateSnapshot(raw: unknown): SignalSnapshot | null {
  if (raw === null || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const kind = o['kind'];
  const observedAt = o['observedAt'];
  const data = o['data'];
  if (typeof kind !== 'string' || typeof observedAt !== 'string' || typeof data !== 'object') {
    return null;
  }
  return {
    kind: kind as SignalKind,
    observedAt: new Date(observedAt),
    data: (data ?? {}) as Readonly<Record<string, unknown>>,
  };
}

/** Last persisted snapshot for this kind (append-only step log). */
function lastSnapshotForKind(steps: readonly AgentStep[], kind: SignalKind): SignalSnapshot | null {
  for (let i = steps.length - 1; i >= 0; i -= 1) {
    const s = steps[i];
    if (s && s.kind === 'signal_seen' && s.detail && s.detail['kind'] === kind) {
      return hydrateSnapshot(s.detail['snapshot']);
    }
  }
  return null;
}

@Injectable()
export class RunWatchCycleUseCase {
  private readonly logger: AppLogger = createLogger('agent.run-watch-cycle');

  constructor(
    @Inject(TRIP_REPOSITORY) private readonly trips: TripRepository,
    @Inject(GeoQueries) private readonly geo: GeoQueries,
    @Inject(SIGNAL_SOURCE_PORT) private readonly signals: SignalSource,
    @Inject(EvaluateSignalsUseCase) private readonly evaluate: EvaluateSignalsUseCase,
    @Inject(ProposeReplanUseCase) private readonly propose: ProposeReplanUseCase,
    @Inject(DraftMemoryBookUseCase) private readonly draft: DraftMemoryBookUseCase,
    @Inject(AGENT_RUN_REPOSITORY) private readonly runs: AgentRunRepository,
    @Inject(TRIP_WATCH_REPOSITORY) private readonly watches: TripWatchRepository,
  ) {}

  async execute(watch: TripWatch, now: Date = new Date()): Promise<WatchCycleOutcome> {
    const trip = await this.trips.findById(watch.tripId);
    if (!trip) {
      // Trip deleted out from under the watch — drain it.
      await this.watches.deactivate(watch.tripId);
      return { outcome: 'orphan' };
    }

    // Trip-end trigger → the 2C.1 memory payoff fires for real.
    if (trip.endsOn !== null && trip.endsOn.getTime() < now.getTime()) {
      const res = await this.draft.execute({
        agentRunId: watch.agentRunId,
        tripId: trip.id,
        ownerId: trip.userId,
        title: trip.title,
      });
      await this.watches.deactivate(trip.id);
      await this.runs.markClosed(watch.agentRunId);
      this.logger.info(
        { tripId: trip.id, agentRunId: watch.agentRunId, memoryBookId: res.memoryBookId },
        'watch_closed_book_drafted',
      );
      return {
        outcome: 'closed',
        memoryBookId: res.memoryBookId,
        alreadyDrafted: res.alreadyDrafted,
      };
    }

    const center = await this.geo.findTripCenter(trip.id);
    if (!center) {
      // Coordinates not resolved yet — nothing to poll; retry next tick.
      return { outcome: 'no-center' };
    }

    const steps = await this.runs.listSteps(watch.agentRunId);
    for (const kind of watch.subscribedSignals) {
      const previous = lastSnapshotForKind(steps, kind);
      const current = await this.signals.snapshot({ kind, lat: center.lat, lng: center.lng });
      await this.runs.appendStep({
        agentRunId: watch.agentRunId,
        kind: 'signal_seen',
        detail: {
          kind,
          snapshot: {
            kind: current.kind,
            observedAt: current.observedAt.toISOString(),
            data: current.data,
          },
        },
      });
      const threshold = watch.thresholds[kind] ?? DEFAULT_THRESHOLD;
      const diffs = this.evaluate.execute({ previous, current, threshold });
      if (diffs.length > 0) {
        await this.propose.execute({
          agentRunId: watch.agentRunId,
          tripId: trip.id,
          ownerId: trip.userId,
          trip: {
            title: trip.title,
            lat: center.lat,
            lng: center.lng,
            radiusKm: trip.radiusKm,
            startsOn: trip.startsOn,
            endsOn: trip.endsOn,
          },
          diffs,
          reason: diffs[0]?.reason ?? 'signal change',
        });
        return { outcome: 'proposed', kind };
      }
    }
    return { outcome: 'no-change' };
  }
}
