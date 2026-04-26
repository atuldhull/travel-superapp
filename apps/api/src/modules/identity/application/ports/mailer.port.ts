/**
 * Port: outbound transactional email. Two adapters today:
 *   - `StubMailerAdapter` — logs the message via `@app/logger` and
 *     records it in an in-memory ring buffer so dev + e2e tests can
 *     inspect the contents (deterministic). Always registered.
 *   - `ResendMailerAdapter` — wraps the Resend HTTP API; activated
 *     when `RESEND_API_KEY` is set. (Wired in a follow-up — for now
 *     the stub serves both dev and CI, and Real-email lands once a
 *     prod API key is provisioned.)
 *
 * Installed by prompt [V.UX.2].
 */
export const MAILER_PORT = Symbol('MAILER_PORT');

export interface MailMessage {
  readonly to: string;
  readonly subject: string;
  readonly textBody: string;
  /** Optional HTML body. Stub adapter ignores; real provider sends both. */
  readonly htmlBody?: string;
}

export interface MailerPort {
  send(message: MailMessage): Promise<void>;
}
