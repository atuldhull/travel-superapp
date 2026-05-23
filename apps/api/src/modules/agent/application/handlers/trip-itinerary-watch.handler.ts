/**
 * Agent↔trip real triggers — the watch-START trigger.
 *
 * Subscribes to `Trip.ItineraryGenerated` (emitted by
 * generate-itinerary-stub.use-case): once a trip has an itinerary
 * there is something concrete for the agent to watch, so it opens a
 * TripWatch. Mirrors AgentReplanProposedHandler exactly (boot-time
 * subscribe, unsubscribe on destroy).
 *
 * Hex/direction: trip → (event bus) → agent. The Trip module stays
 * completely unaware of the agent (no import, no cycle) — the only
 * coupling is the already-published domain event.
 *
 * LAW 1/2:
 *   - Flag-gated: a NO-OP unless FEATURE_AGENT_ENABLED (the feature
 *     ships dark; mirrors AgentController.requireAgent()).
 *   - Idempotent: itineraries regenerate; a re-fire just hits the
 *     "one active watch per trip" invariant and is swallowed.
 *   - Best-effort: a handler must NEVER throw back into the bus.
 *   - Only the trip's own coordinates ever leave the system later
 *     (the watch stores no PII).
 *
 * Installed by the agent↔trip real-triggers slice.
 */
import { Inject, Injectable, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EVENT_BUS, type EventBus, type Subscription } from '@app/events';
import type { Env } from '@app/config';
import { createLogger } from '@app/logger';
import type { TripItineraryGeneratedPayload } from '../../../trip';
import { StartTripWatchUseCase } from '../start-trip-watch.use-case';

const log = createLogger('agent.trip-itinerary-watch');

const CONSUMER_GROUP = 'agent.trip-itinerary-watch';
const EVENT_NAME = 'Trip.ItineraryGenerated';

/** Default loop: weather only (free, keyless, degrades to no-change
 *  offline). Flight/geofence stay opt-in — nothing new leaves the
 *  system by default (LAW 2). 0.7 = 70% precip probability gate. */
const DEFAULT_THRESHOLDS: Readonly<Record<string, number>> = { weather: 0.7 };

@Injectable()
export class TripItineraryWatchHandler implements OnApplicationBootstrap, OnModuleDestroy {
  private subscription: Subscription | null = null;

  constructor(
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(ConfigService) private readonly config: ConfigService<Env, true>,
    @Inject(StartTripWatchUseCase) private readonly startWatch: StartTripWatchUseCase,
  ) {}

  onApplicationBootstrap(): void {
    this.subscription = this.events.subscribe<TripItineraryGeneratedPayload>(
      EVENT_NAME,
      (evt) => this.handle(evt.payload, evt.id, evt.traceId),
      { consumerGroup: CONSUMER_GROUP },
    );
    log.info({ consumerGroup: CONSUMER_GROUP }, 'agent_handler_subscribed');
  }

  async onModuleDestroy(): Promise<void> {
    if (this.subscription) {
      await this.subscription.unsubscribe();
      this.subscription = null;
    }
  }

  private async handle(
    payload: TripItineraryGeneratedPayload,
    eventId: string,
    traceId: string | undefined,
  ): Promise<void> {
    // Dark unless explicitly enabled — keeps the agent fully inert
    // in environments that haven't opted in.
    if (!this.config.get('FEATURE_AGENT_ENABLED', { infer: true })) {
      return;
    }
    try {
      const res = await this.startWatch.execute({
        tripId: payload.tripId,
        subscribedSignals: ['weather'],
        thresholds: DEFAULT_THRESHOLDS,
      });
      log.info(
        { eventId, traceId, tripId: payload.tripId, agentRunId: res.agentRunId },
        'agent_watch_started_from_itinerary',
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const code = (err as { code?: unknown }).code;
      if (code === 'TRIP_WATCH_ALREADY_ACTIVE') {
        // Idempotent: the trip is already watched (itinerary regen).
        log.info({ tripId: payload.tripId }, 'agent_watch_already_active_noop');
        return;
      }
      // Never throw back into the bus — log and move on.
      log.warn({ tripId: payload.tripId, err: msg }, 'agent_watch_start_failed');
    }
  }
}
