/**
 * `NotificationSender` adapter that:
 *   1. Logs a structured "would have been sent" line.
 *   2. Persists a row in `NotificationLog` via the repo, so users
 *      can `GET /notifications/me` and ops can audit fan-out
 *      without subscribing to the EventBus.
 *   3. Mirrors the dispatched payload into an in-memory ring
 *      buffer so integration tests can `peekSent` / `drainSent`
 *      without round-tripping through the DB.
 *
 * Persistence is best-effort: a DB hiccup MUST NOT bubble back to
 * the handler — the EventBus would then retry the whole event,
 * causing duplicate logs + duplicate sends. Caller's contract is
 * "fire-and-forget"; we keep that promise even when persistence
 * fails. A future real adapter (Resend / Twilio) will start the
 * row in `queued` and flip on provider ack; the sync logging
 * stub here writes `delivered` immediately because the dispatch
 * is fully synchronous and always succeeds.
 *
 * Installed by prompt [IV.18.2.8]; persistence layer added in
 * [IV.18.15.1].
 */
import { Inject, Injectable } from '@nestjs/common';
import { createLogger } from '@app/logger';
import {
  NOTIFICATION_LOG_REPOSITORY,
  type NotificationLogRepository,
} from '../application/ports/notification-log.repository';
import type {
  NotificationSender,
  SendNotificationInput,
} from '../application/ports/notification-sender';

const log = createLogger('notifications.sender');

@Injectable()
export class LoggingNotificationSender implements NotificationSender {
  /**
   * In-memory log of everything this sender has been asked to
   * dispatch. Consumed by tests; prod code should NOT read it
   * (prod uses a real SMTP adapter). Bounded at 100 entries to
   * keep memory steady during long-running dev sessions.
   */
  private readonly sent: SendNotificationInput[] = [];
  private static readonly MAX_HISTORY = 100;

  constructor(
    @Inject(NOTIFICATION_LOG_REPOSITORY)
    private readonly logRepo: NotificationLogRepository,
  ) {}

  async send(input: SendNotificationInput): Promise<void> {
    log.info(
      {
        userId: input.userId,
        channel: input.channel,
        template: input.templateKey,
        subject: input.subject,
      },
      'notification_send_stub',
    );
    this.sent.push(input);
    if (this.sent.length > LoggingNotificationSender.MAX_HISTORY) {
      this.sent.shift();
    }

    try {
      const now = new Date();
      await this.logRepo.create({
        userId: input.userId,
        channel: input.channel,
        templateId: input.templateKey,
        // Logging stub is synchronous; the row goes straight to
        // `delivered`. Real adapters set `queued` until provider
        // ack; that's their concern, not the port's.
        status: 'delivered',
        payload: {
          subject: input.subject,
          body: input.body,
          context: input.context,
        },
        deliveredAt: now,
      });
    } catch (err) {
      log.warn(
        {
          err: err instanceof Error ? err.message : String(err),
          userId: input.userId,
          template: input.templateKey,
        },
        'notification_log_persist_failed',
      );
    }
  }

  /** Test-only helper: drain the in-memory history. */
  drainSent(): readonly SendNotificationInput[] {
    const copy = [...this.sent];
    this.sent.length = 0;
    return copy;
  }

  /** Test-only helper: inspect without clearing. */
  peekSent(): readonly SendNotificationInput[] {
    return this.sent;
  }
}
