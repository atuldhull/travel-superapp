/**
 * POST.2A.4 — notify the trip owner when the agent proposes a
 * re-plan. Subscribes to `Trip.ReplanProposed` (the `Trip.` /
 * `trip_` prefix routes it to the existing 'trip' notification
 * category — NO edit to NOTIFICATION_CATEGORIES or the helper).
 *
 * Mirrors ItineraryReadyHandler exactly (boot-time subscribe,
 * unsubscribe on destroy, single push via NOTIFICATION_SENDER).
 *
 * Installed by prompt [POST.2A.4].
 */
import { Inject, Injectable, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { EVENT_BUS, type EventBus, type Subscription } from '@app/events';
import { createLogger } from '@app/logger';
import type { ReplanProposedPayload } from '../../../agent';
import { NOTIFICATION_SENDER, type NotificationSender } from '../ports/notification-sender';

const log = createLogger('notifications.agent-replan-proposed');

const CONSUMER_GROUP = 'notifications.agent-replan-proposed';
const EVENT_NAME = 'Trip.ReplanProposed';

@Injectable()
export class AgentReplanProposedHandler implements OnApplicationBootstrap, OnModuleDestroy {
  private subscription: Subscription | null = null;

  constructor(
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(NOTIFICATION_SENDER) private readonly sender: NotificationSender,
  ) {}

  onApplicationBootstrap(): void {
    this.subscription = this.events.subscribe<ReplanProposedPayload>(
      EVENT_NAME,
      (evt) => this.handle(evt.payload, evt.id, evt.traceId),
      { consumerGroup: CONSUMER_GROUP },
    );
    log.info({ consumerGroup: CONSUMER_GROUP }, 'notifications_handler_subscribed');
  }

  async onModuleDestroy(): Promise<void> {
    if (this.subscription) {
      await this.subscription.unsubscribe();
      this.subscription = null;
    }
  }

  private async handle(
    payload: ReplanProposedPayload,
    eventId: string,
    traceId: string | undefined,
  ): Promise<void> {
    log.info(
      { eventId, traceId, tripId: payload.tripId, proposalId: payload.proposalId },
      'agent_replan_proposed_received',
    );
    await this.sender.send({
      userId: payload.ownerId,
      channel: 'push',
      // `trip_` prefix → existing 'trip' category (no schema edit).
      templateKey: 'trip_agent_replan_proposed',
      subject: 'Your trip agent suggests a change',
      body: `${payload.summary} — open the trip to accept or decline.`,
      context: {
        eventId,
        traceId: traceId ?? null,
        tripId: payload.tripId,
        proposalId: payload.proposalId,
      },
    });
  }
}
