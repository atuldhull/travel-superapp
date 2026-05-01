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
 * Safety.SosTriggered handler added in [IV.18.15.1]. V.UX.26
 * adds: Web Push subscription surface, per-category prefs, swipe-
 * to-archive, weekly-digest scheduler.
 */
import { Module } from '@nestjs/common';
import { ArchiveNotificationUseCase } from './application/archive-notification.use-case';
import { DeleteNotificationUseCase } from './application/delete-notification.use-case';
import { GetNotificationPreferencesUseCase } from './application/get-notification-preferences.use-case';
import { ItineraryReadyHandler } from './application/handlers/itinerary-ready.handler';
import { TripLockedHandler } from './application/handlers/trip-locked.handler';
import { SessionIssuedHandler } from './application/handlers/session-issued.handler';
import { SosTriggeredHandler } from './application/handlers/sos-triggered.handler';
import { GetUnreadCountUseCase } from './application/get-unread-count.use-case';
import { ListMyNotificationsUseCase } from './application/list-my-notifications.use-case';
import { MarkAllNotificationsReadUseCase } from './application/mark-all-notifications-read.use-case';
import { MarkNotificationReadUseCase } from './application/mark-notification-read.use-case';
import { MarkNotificationUnreadUseCase } from './application/mark-notification-unread.use-case';
import { NOTIFICATION_LOG_REPOSITORY } from './application/ports/notification-log.repository';
import { NOTIFICATION_PREFERENCE_REPOSITORY } from './application/ports/notification-preference.repository';
import { NOTIFICATION_SENDER } from './application/ports/notification-sender';
import { PUSH_SUBSCRIPTION_REPOSITORY } from './application/ports/push-subscription.repository';
import { SendWeeklyDigestUseCase } from './application/send-weekly-digest.use-case';
import { SubscribePushUseCase } from './application/subscribe-push.use-case';
import { UnsubscribePushUseCase } from './application/unsubscribe-push.use-case';
import { UpdateNotificationPreferencesUseCase } from './application/update-notification-preferences.use-case';
import { LoggingNotificationSender } from './infrastructure/logging-notification-sender';
import { PrismaNotificationLogRepository } from './infrastructure/prisma-notification-log.repository';
import { PrismaNotificationPreferenceRepository } from './infrastructure/prisma-notification-preference.repository';
import { PrismaPushSubscriptionRepository } from './infrastructure/prisma-push-subscription.repository';
import { WebPushDispatcher } from './infrastructure/web-push-dispatcher';
import { NotificationsController } from './interface/notifications.controller';
import { NotificationPreferencesController } from './interface/notification-preferences.controller';
import { PushSubscriptionsController } from './interface/push-subscriptions.controller';
import { WeeklyDigestScheduler } from './interface/weekly-digest.scheduler';

@Module({
  controllers: [
    NotificationsController,
    NotificationPreferencesController,
    PushSubscriptionsController,
  ],
  providers: [
    { provide: NOTIFICATION_LOG_REPOSITORY, useClass: PrismaNotificationLogRepository },
    {
      provide: NOTIFICATION_PREFERENCE_REPOSITORY,
      useClass: PrismaNotificationPreferenceRepository,
    },
    { provide: PUSH_SUBSCRIPTION_REPOSITORY, useClass: PrismaPushSubscriptionRepository },
    WebPushDispatcher,
    // Concrete sender — exposed as itself too so tests can
    // `moduleRef.get(LoggingNotificationSender)` to drain history.
    LoggingNotificationSender,
    { provide: NOTIFICATION_SENDER, useExisting: LoggingNotificationSender },
    SessionIssuedHandler,
    ItineraryReadyHandler,
    TripLockedHandler,
    SosTriggeredHandler,
    ListMyNotificationsUseCase,
    MarkNotificationReadUseCase,
    MarkAllNotificationsReadUseCase,
    GetUnreadCountUseCase,
    MarkNotificationUnreadUseCase,
    DeleteNotificationUseCase,
    ArchiveNotificationUseCase,
    GetNotificationPreferencesUseCase,
    UpdateNotificationPreferencesUseCase,
    SubscribePushUseCase,
    UnsubscribePushUseCase,
    SendWeeklyDigestUseCase,
    WeeklyDigestScheduler,
  ],
  exports: [
    NOTIFICATION_SENDER,
    NOTIFICATION_LOG_REPOSITORY,
    NOTIFICATION_PREFERENCE_REPOSITORY,
    PUSH_SUBSCRIPTION_REPOSITORY,
    LoggingNotificationSender,
  ],
})
export class NotificationsModule {}
