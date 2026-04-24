/**
 * Port for the queryable notification ledger.
 *
 *   - `create`  — invoked by the sender after a successful in-memory
 *                 dispatch. v1 inserts in `delivered` status because
 *                 the LoggingSender is synchronous + always succeeds;
 *                 a real Resend/Twilio adapter will start `queued` and
 *                 flip on provider ack.
 *   - `listForUser` — owner-gated, most-recent-first. Used by
 *                     `GET /api/v1/notifications/me`.
 *
 * Installed by prompt [IV.18.15.1].
 */
import type {
  NotificationChannel,
  NotificationDeliveryStatus,
  NotificationLog,
} from '../../domain/notification-log.entity';

export interface CreateNotificationLogInput {
  readonly userId: string;
  readonly channel: NotificationChannel;
  readonly templateId: string;
  readonly status: NotificationDeliveryStatus;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly deliveredAt: Date | null;
}

export interface NotificationLogRepository {
  create(input: CreateNotificationLogInput): Promise<NotificationLog>;
  listForUser(userId: string, limit: number): Promise<readonly NotificationLog[]>;
}

export const NOTIFICATION_LOG_REPOSITORY = Symbol('NotificationLogRepository');
