/**
 * Handler for `Trip.ItineraryGenerated`. Logs + sends a stub
 * "your plan is ready" notification through the sender port.
 *
 * Same lifecycle + isolation rules as SessionIssuedHandler.
 *
 * Installed by prompt [IV.18.2.8].
 */
import { Inject, Injectable, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { EVENT_BUS, type EventBus, type Subscription } from '@app/events';
import { createLogger } from '@app/logger';
import { NOTIFICATION_SENDER, type NotificationSender } from '../ports/notification-sender';
import type { TripItineraryGeneratedPayload } from '../../../trip';

const log = createLogger('notifications.itinerary-ready');

const CONSUMER_GROUP = 'notifications.itinerary-ready';
const EVENT_NAME = 'Trip.ItineraryGenerated';

@Injectable()
export class ItineraryReadyHandler implements OnApplicationBootstrap, OnModuleDestroy {
  private subscription: Subscription | null = null;

  constructor(
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(NOTIFICATION_SENDER) private readonly sender: NotificationSender,
  ) {}

  onApplicationBootstrap(): void {
    this.subscription = this.events.subscribe<TripItineraryGeneratedPayload>(
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
    payload: TripItineraryGeneratedPayload,
    eventId: string,
    traceId: string | undefined,
  ): Promise<void> {
    log.info(
      {
        eventId,
        traceId,
        userId: payload.userId,
        tripId: payload.tripId,
        dayCount: payload.dayCount,
      },
      'itinerary_generated_received',
    );
    await this.sender.send({
      userId: payload.userId,
      channel: 'push',
      templateKey: 'trip_itinerary_ready',
      subject: 'Your trip plan is ready',
      body: `We've built a ${payload.dayCount}-day plan for your trip. Tap to review and adjust.`,
      context: {
        eventId,
        traceId: traceId ?? null,
        tripId: payload.tripId,
        dayCount: payload.dayCount,
      },
    });
  }
}
