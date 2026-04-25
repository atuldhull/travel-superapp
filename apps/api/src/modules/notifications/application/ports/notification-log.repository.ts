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
  /**
   * Flip `read = true` on a row the caller owns. Returns the
   * updated row, or `null` when the id is unknown OR owned by a
   * different user — the use-case collapses both signals to a
   * single 404 for IDOR safety. Idempotent: re-marking an
   * already-read row still returns the row.
   */
  markReadForUser(id: string, userId: string): Promise<NotificationLog | null>;
  /**
   * Mark every unread notification for the caller as read in
   * one round-trip. Returns the number of rows actually flipped
   * (0 when the inbox was empty or already-fully-read). Idempotent
   * by construction — second call with no new unread rows returns
   * 0.
   *
   * Owner-scoped on `userId`. The `read: false` clause skips
   * already-read rows so the operation cost scales with unread
   * count, not total inbox size.
   */
  markAllReadForUser(userId: string): Promise<number>;
  /**
   * Count unread notifications for the caller. Single indexed
   * Prisma `count` — hits the existing `[userId, read, createdAt]`
   * index. Drives the home-screen unread badge: clients render
   * "5" without paginating the inbox.
   *
   * Added by `[IV.18.15.4]`.
   */
  countUnreadForUser(userId: string): Promise<number>;
  /**
   * Symmetric companion to `markReadForUser` — flips `read = false`
   * on a row the caller owns. Returns the updated row, or `null`
   * when the id is unknown OR owned by a different user (the
   * use-case collapses both to a single 404 for IDOR safety).
   * Idempotent: re-marking an already-unread row still returns
   * the row.
   *
   * Added by `[IV.18.15.5]`.
   */
  markUnreadForUser(id: string, userId: string): Promise<NotificationLog | null>;
}

export const NOTIFICATION_LOG_REPOSITORY = Symbol('NotificationLogRepository');
