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
  /**
   * Owner-scoped, most-recent-first inbox read. Optional `channel`
   * narrows to a single delivery channel (push / email / sms) for
   * channel-segmented inbox views; absence returns the union.
   *
   * V.UX.26 — when `includeArchived` is false (default) the lister
   * excludes rows with a non-null `archivedAt`. The `/inbox` UI
   * relies on this default; an "All notifications" view can pass
   * `includeArchived: true`.
   *
   * Channel filter added by `[IV.18.12.13]`. Archive filter added by
   * `[V.UX.26]`.
   */
  listForUser(
    userId: string,
    limit: number,
    channel?: NotificationChannel,
    includeArchived?: boolean,
  ): Promise<readonly NotificationLog[]>;
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

  /**
   * Owner-scoped hard delete. Returns `true` iff a row was actually
   * removed. The id-unknown and wrong-owner cases collapse into a
   * single `false`, mapped to 404 `NOTIFICATION_NOT_FOUND` at the
   * use-case layer for IDOR safety. Hard-delete (not soft) — read
   * status doesn't matter; users prune their inbox by removing the
   * row entirely. NotificationLog has no FK dependents, so cascade
   * is trivial.
   *
   * Added by `[IV.18.15.6]`.
   */
  deleteForUser(id: string, userId: string): Promise<boolean>;
  /**
   * V.UX.26 — soft-archive (swipe-to-archive). Sets `archivedAt = now()`
   * if it isn't already set. Owner-scoped + IDOR-safe (id+owner both
   * narrowed in the where-clause; missing/wrong-owner both yield false).
   * Idempotent: re-archiving a row that's already archived returns true
   * without touching the timestamp.
   */
  archiveForUser(id: string, userId: string): Promise<boolean>;
  /**
   * V.UX.26 — count delivered notifications for the user since `since`.
   * Powers the weekly digest body. Filters out archived rows.
   */
  countDeliveredSince(userId: string, since: Date): Promise<number>;
}

export const NOTIFICATION_LOG_REPOSITORY = Symbol('NotificationLogRepository');
