/**
 * In-monolith Notifications module. Subscribes to the shared
 * EventBus (provided by `EventsModule`) and dispatches
 * side-effects via the `NotificationSender` port.
 *
 * ADR-002 trigger for extraction to a separate
 * `apps/notification-worker`:
 *   - Emit volume sustained > 100/s.
 *   - Email / SMS / push fan-out > 10× the monolith's request volume.
 *   - A notification failure MUST NOT risk the api's event loop
 *     (we're currently fire-and-forget, so this is already fine,
 *     but SMTP retries + real scheduling pushes it into its own
 *     process).
 *
 * Today: in-monolith. Swap to the worker by exporting the same
 * handlers from the new app + switching EventsModule to the
 * RedisStreamsEventBus adapter.
 *
 * Installed by prompt [IV.18.2.8].
 */
import { Module } from '@nestjs/common';
import { ItineraryReadyHandler } from './application/handlers/itinerary-ready.handler';
import { SessionIssuedHandler } from './application/handlers/session-issued.handler';
import { NOTIFICATION_SENDER } from './application/ports/notification-sender';
import { LoggingNotificationSender } from './infrastructure/logging-notification-sender';

@Module({
  providers: [
    // Concrete sender — exposed as itself too so tests can
    // `moduleRef.get(LoggingNotificationSender)` to drain history.
    LoggingNotificationSender,
    { provide: NOTIFICATION_SENDER, useExisting: LoggingNotificationSender },
    SessionIssuedHandler,
    ItineraryReadyHandler,
  ],
  exports: [NOTIFICATION_SENDER, LoggingNotificationSender],
})
export class NotificationsModule {}
