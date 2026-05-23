/**
 * Handler for `Identity.SessionIssued`. Today: logs a "new sign-in"
 * stub. Planned: resolve the user's emailEncrypted + send a
 * "new device sign-in" email unless the device fingerprint was
 * already seen (dedupe via `deviceId` once device auto-create is
 * wired — deferred to its own prompt).
 *
 * Idempotence: keyed on `event.id`. The handler is re-run on retry
 * after a DLQ path; real adapters dedupe via an external store
 * (Redis SET with TTL). Logging adapter in this slice is inherently
 * idempotent — re-runs just log twice, which the tests explicitly
 * allow.
 *
 * Error isolation: throws from here hit the EventBus retry / DLQ
 * machinery. They MUST NOT propagate back to the emitter's call
 * site — verified by the events-handler-errors test.
 *
 * Installed by prompt [IV.18.2.8].
 */
import { Inject, Injectable, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { EVENT_BUS, type EventBus, type Subscription } from '@app/events';
import { createLogger } from '@app/logger';
import { NOTIFICATION_SENDER, type NotificationSender } from '../ports/notification-sender';
import type { SessionIssuedPayload } from '../../../identity';

const log = createLogger('notifications.session-issued');

const CONSUMER_GROUP = 'notifications.session-issued';
const EVENT_NAME = 'Identity.SessionIssued';

@Injectable()
export class SessionIssuedHandler implements OnApplicationBootstrap, OnModuleDestroy {
  private subscription: Subscription | null = null;

  constructor(
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(NOTIFICATION_SENDER) private readonly sender: NotificationSender,
  ) {}

  onApplicationBootstrap(): void {
    // Subscribe AFTER everything else in the DI graph is ready —
    // onModuleInit runs too early and the EventBus isn't guaranteed
    // to be initialised yet. Bootstrap runs exactly once per process.
    this.subscription = this.events.subscribe<SessionIssuedPayload>(
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
    payload: SessionIssuedPayload,
    eventId: string,
    traceId: string | undefined,
  ): Promise<void> {
    log.info(
      {
        eventId,
        traceId,
        userId: payload.userId,
        sessionId: payload.sessionId,
      },
      'session_issued_received',
    );
    await this.sender.send({
      userId: payload.userId,
      channel: 'email',
      templateKey: 'session_issued_new_device',
      subject: 'New sign-in to your TravelSuperApp account',
      body: `We noticed a new sign-in on ${payload.userAgent ?? 'an unknown device'}. If this wasn't you, please change your password.`,
      context: {
        eventId,
        traceId: traceId ?? null,
        sessionId: payload.sessionId,
        userAgent: payload.userAgent,
        ipHash: payload.ipHash,
      },
    });
  }
}
