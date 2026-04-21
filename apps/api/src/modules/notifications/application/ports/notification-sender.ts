/**
 * Port for delivering a notification to a user. The real adapter
 * will dispatch by `channel`:
 *   - 'email'   → Resend / SendGrid / Mailpit in dev.
 *   - 'push'    → Expo / FCM / APNs.
 *   - 'sms'     → Twilio.
 *
 * For this slice the adapter is a no-op logger. The handler
 * contract (shape of `SendNotificationInput`, which handlers call
 * which channel) is stable; swapping to a real SMTP adapter is a
 * factory change, not a use-case change.
 *
 * Installed by prompt [IV.18.2.8].
 */
export type NotificationChannel = 'email' | 'push' | 'sms';

export interface SendNotificationInput {
  readonly userId: string;
  readonly channel: NotificationChannel;
  /** Short machine name — same value goes into analytics + i18n keys.
   *  E.g. `session_issued_new_device`, `trip_itinerary_ready`. */
  readonly templateKey: string;
  /** Rendered subject line. Real adapters may swap this for
   *  i18n-resolved copy; the in-monolith stub just carries it. */
  readonly subject: string;
  /** Rendered body (plaintext fallback; HTML adapters read a
   *  per-template file by `templateKey`). */
  readonly body: string;
  /** Metadata for downstream analytics — tripId, sessionId, etc. */
  readonly context: Readonly<Record<string, unknown>>;
}

export interface NotificationSender {
  send(input: SendNotificationInput): Promise<void>;
}

export const NOTIFICATION_SENDER = Symbol('NotificationSender');
