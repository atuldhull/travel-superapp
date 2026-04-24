/**
 * Handler for `Safety.SosTriggered`. Sends a high-priority push
 * stub so the user sees a confirmation that their SOS was
 * received + recorded — and so a future emergency-contact
 * fan-out subscriber has parity with how every other channel
 * gets routed through the sender port.
 *
 * Real adapters (when emergency-contacts ship) will read the
 * caller's contact list + emit one notification per contact.
 * v1 just confirms back to the user: "your SOS was received,
 * help is being notified."
 *
 * Same lifecycle + isolation rules as SessionIssuedHandler /
 * ItineraryReadyHandler — subscribe at bootstrap, unsubscribe
 * on destroy, errors don't propagate to the emitter.
 *
 * Installed by prompt [IV.18.15.1].
 */
import { Inject, Injectable, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { EVENT_BUS, type EventBus, type Subscription } from '@app/events';
import { createLogger } from '@app/logger';
import { NOTIFICATION_SENDER, type NotificationSender } from '../ports/notification-sender';
import type { SosTriggeredPayload } from '../../../safety/domain/safety.events';

const log = createLogger('notifications.sos-triggered');

const CONSUMER_GROUP = 'notifications.sos-triggered';
const EVENT_NAME = 'Safety.SosTriggered';

@Injectable()
export class SosTriggeredHandler implements OnApplicationBootstrap, OnModuleDestroy {
  private subscription: Subscription | null = null;

  constructor(
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(NOTIFICATION_SENDER) private readonly sender: NotificationSender,
  ) {}

  onApplicationBootstrap(): void {
    this.subscription = this.events.subscribe<SosTriggeredPayload>(
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
    payload: SosTriggeredPayload,
    eventId: string,
    traceId: string | undefined,
  ): Promise<void> {
    log.info(
      {
        eventId,
        traceId,
        userId: payload.userId,
        sosEventId: payload.sosEventId,
        trigger: payload.trigger,
      },
      'sos_triggered_received',
    );
    await this.sender.send({
      userId: payload.userId,
      channel: 'push',
      templateKey: 'safety_sos_received',
      subject: 'SOS received',
      body: 'Your SOS was received. Stay where you are if it is safe; help is being notified.',
      context: {
        eventId,
        traceId: traceId ?? null,
        sosEventId: payload.sosEventId,
        trigger: payload.trigger,
        lat: payload.lat,
        lng: payload.lng,
      },
    });
  }
}
