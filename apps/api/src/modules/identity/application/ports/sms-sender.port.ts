/**
 * Port: outbound SMS (used by the phone sign-in code flow, B1).
 * Two adapters, same factory shape as the mailer:
 *   - StubSmsSenderAdapter — logs + keeps a ring buffer ($0, no key;
 *     dev + e2e). Always registered.
 *   - TwilioSmsSenderAdapter — wraps the twilio SDK; the module
 *     factory activates it only when TWILIO_ACCOUNT_SID +
 *     TWILIO_AUTH_TOKEN + TWILIO_FROM_NUMBER are all set, else stub.
 *
 * Installed for Phase 1 — Onboarding & Identity.
 */
export const SMS_SENDER = Symbol('SMS_SENDER');

export interface SmsMessage {
  /** Destination phone in E.164-ish form (digits, optional leading +). */
  readonly to: string;
  readonly body: string;
}

export interface SmsSender {
  send(message: SmsMessage): Promise<void>;
}
