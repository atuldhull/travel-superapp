/**
 * POST.2A.2 — start a trip's agent watch.
 *
 * Enforces the domain invariant: a trip may have AT MOST ONE active
 * TripWatch (a trip accumulates closed watches over time, so this is
 * a use-case guard, not a DB unique constraint). Creates the
 * AgentRun, the TripWatch, and the first append-only AgentStep.
 *
 * Bound into AgentModule when the Prisma adapters land (deferred
 * from POST.2A.2 — DB migration apply + `prisma generate` are
 * blocked unattended). The invariant is proven now by a fake-repo
 * unit test (no DB).
 *
 * Installed by prompt [POST.2A.2].
 */
import { Inject, Injectable } from '@nestjs/common';
import { ConflictError } from '@app/errors';
import { createLogger, type AppLogger } from '@app/logger';
import type { SignalKind } from '../domain/trip-watch.entity';
import { AGENT_RUN_REPOSITORY, type AgentRunRepository } from './ports/agent-run.repository';
import { TRIP_WATCH_REPOSITORY, type TripWatchRepository } from './ports/trip-watch.repository';

export interface StartTripWatchCommand {
  readonly tripId: string;
  readonly subscribedSignals: readonly SignalKind[];
  readonly thresholds: Readonly<Record<string, number>>;
}

export interface StartTripWatchResult {
  readonly agentRunId: string;
  readonly tripWatchId: string;
}

@Injectable()
export class StartTripWatchUseCase {
  private readonly logger: AppLogger = createLogger('agent.start-trip-watch');

  constructor(
    @Inject(AGENT_RUN_REPOSITORY) private readonly runs: AgentRunRepository,
    @Inject(TRIP_WATCH_REPOSITORY) private readonly watches: TripWatchRepository,
  ) {}

  async execute(cmd: StartTripWatchCommand): Promise<StartTripWatchResult> {
    const existing = await this.watches.findActiveByTrip(cmd.tripId);
    if (existing) {
      throw new ConflictError(
        'Trip already has an active agent watch',
        { tripId: cmd.tripId },
        'TRIP_WATCH_ALREADY_ACTIVE',
      );
    }

    const run = await this.runs.create({ tripId: cmd.tripId });
    const watch = await this.watches.create({
      tripId: cmd.tripId,
      agentRunId: run.id,
      subscribedSignals: cmd.subscribedSignals,
      thresholds: cmd.thresholds,
    });
    await this.runs.appendStep({
      agentRunId: run.id,
      kind: 'watch_started',
      detail: { subscribedSignals: cmd.subscribedSignals },
    });

    this.logger.info({ tripId: cmd.tripId, agentRunId: run.id }, 'trip_watch_started');
    return { agentRunId: run.id, tripWatchId: watch.id };
  }
}
