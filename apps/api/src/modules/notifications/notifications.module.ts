/**
 * In-monolith Notifications module. Subscribes to the shared
 * EventBus (provided by `EventsModule`) and dispatches
 * side-effects via the `NotificationSender` port. Persists every
 * dispatched notification through the `NotificationLog` repo so
 * users can query their own ledger via `GET /notifications/me`.
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
 * Installed by prompt [IV.18.2.8]. Persistence + read-API +
 * Safety.SosTriggered handler added in [IV.18.15.1].
 */
import { Module } from '@nestjs/common';
import { ItineraryReadyHandler } from './application/handlers/itinerary-ready.handler';
import { SessionIssuedHandler } from './application/handlers/session-issued.handler';
import { SosTriggeredHandler } from './application/handlers/sos-triggered.handler';
import { GetUnreadCountUseCase } from './application/get-unread-count.use-case';
import { ListMyNotificationsUseCase } from './application/list-my-notifications.use-case';
import { MarkAllNotificationsReadUseCase } from './application/mark-all-notifications-read.use-case';
import { MarkNotificationReadUseCase } from './application/mark-notification-read.use-case';
import { MarkNotificationUnreadUseCase } from './application/mark-notification-unread.use-case';
import { NOTIFICATION_LOG_REPOSITORY } from './application/ports/notification-log.repository';
import { NOTIFICATION_SENDER } from './application/ports/notification-sender';
import { LoggingNotificationSender } from './infrastructure/logging-notification-sender';
import { PrismaNotificationLogRepository } from './infrastructure/prisma-notification-log.repository';
import { NotificationsController } from './interface/notifications.controller';

@Module({
  controllers: [NotificationsController],
  providers: [
    { provide: NOTIFICATION_LOG_REPOSITORY, useClass: PrismaNotificationLogRepository },
    // Concrete sender — exposed as itself too so tests can
    // `moduleRef.get(LoggingNotificationSender)` to drain history.
    LoggingNotificationSender,
    { provide: NOTIFICATION_SENDER, useExisting: LoggingNotificationSender },
    SessionIssuedHandler,
    ItineraryReadyHandler,
    SosTriggeredHandler,
    ListMyNotificationsUseCase,
    MarkNotificationReadUseCase,
    MarkAllNotificationsReadUseCase,
    GetUnreadCountUseCase,
    MarkNotificationUnreadUseCase,
  ],
  exports: [NOTIFICATION_SENDER, NOTIFICATION_LOG_REPOSITORY, LoggingNotificationSender],
})
export class NotificationsModule {}
