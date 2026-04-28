/**
 * V.UX.13 — port for fanning out an SOS event to a traveler's
 * trusted contacts. v1 is a stub (in-memory ring buffer); a future
 * Twilio adapter swaps in via the same port without touching the
 * use-case.
 *
 * The use-case calls `notify()` once per contact, in parallel via
 * Promise.allSettled — a single failed contact (bad number, SMS
 * provider down) MUST NOT stop the others from being notified, and
 * MUST NOT bring down the SOS write itself.
 *
 * Installed by prompt [V.UX.13].
 */
export interface SosNotificationPayload {
  readonly contactName: string;
  readonly phone: string | null;
  readonly email: string | null;
  readonly travelerUserId: string;
  readonly trigger: string;
  readonly lat: number;
  readonly lng: number;
  readonly sosEventId: string;
  readonly triggeredAt: Date;
}

export interface ContactNotifier {
  /**
   * Send the SOS message to one contact. Implementations should
   * handle their own retries / channel selection (SMS first,
   * fallback to email). Returning normally = "delivered to provider";
   * thrown errors are caught at the caller (Promise.allSettled).
   */
  notify(payload: SosNotificationPayload): Promise<void>;
}

export const CONTACT_NOTIFIER_PORT = Symbol('ContactNotifier');
