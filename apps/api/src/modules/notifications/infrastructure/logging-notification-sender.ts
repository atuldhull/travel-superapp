/**
 * Stub NotificationSender that logs instead of dispatching.
 *
 * Gives us:
 *   - Visibility into "what would have been sent" during dev + CI.
 *   - Structured data the events integration test asserts against —
 *     the handlers' behaviour is verified via the log call, not
 *     SMTP traffic.
 *
 * Real adapters (ResendNotificationSender / TwilioNotificationSender
 * / ExpoNotificationSender) land in their own prompts and replace
 * this binding in `NotificationsModule`.
 *
 * Installed by prompt [IV.18.2.8].
 */
import { Injectable } from '@nestjs/common';
import { createLogger } from '@app/logger';
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
