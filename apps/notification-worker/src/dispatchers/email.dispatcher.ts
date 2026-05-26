/**
 * Email dispatcher — Resend SDK wrapper.
 *
 * Reads `to / subject / text / html` from the job's `vars` map. When
 * `RESEND_API_KEY` is unset, the dispatcher reports `enabled = false`
 * and the router logs + acks (same posture as ai-service's stub
 * fallback — $0 deploys keep working). When the key IS set but a
 * particular job lacks `to` / `subject` / a body, the dispatcher
 * rejects the job (throws) so BullMQ retries / DLQs per policy.
 *
 * Installed by [S-B1] of the S-series real-functionality closeout.
 */
import { CircuitBreaker } from '@app/resilience';
import { SYSTEM_CLOCK } from '@app/clock';
import { Resend } from 'resend';
import type { AppLogger } from '@app/logger';
import type { NotificationVars } from './types';

export interface EmailDispatcherOptions {
  apiKey: string | undefined;
  /** From address — defaults to `RESEND_FROM_EMAIL`; falls back to a sentinel that Resend will reject so misconfig surfaces immediately. */
  from: string;
}

export class EmailDispatcher {
  private readonly client: Resend | null;
  private readonly from: string;
  private readonly breaker: CircuitBreaker;

  constructor(opts: EmailDispatcherOptions) {
    this.client = opts.apiKey ? new Resend(opts.apiKey) : null;
    this.from = opts.from;
    this.breaker = new CircuitBreaker({
      name: 'notification-worker:resend',
      // Tight breaker — Resend rarely fails; a sustained burst means
      // outage, fast-fail to DLQ rather than tarpitting BullMQ retries.
      failureThreshold: 5,
      openMs: 30_000,
      clock: SYSTEM_CLOCK,
    });
  }

  get enabled(): boolean {
    return this.client !== null;
  }

  /**
   * Send one email. Throws on send failure so BullMQ retries.
   * Returns `false` only when the dispatcher is disabled (no API key);
   * caller logs + acks in that case.
   */
  async send(vars: NotificationVars, logger: AppLogger): Promise<boolean> {
    if (!this.client) return false;

    const to = strOrUndef(vars.to);
    const subject = strOrUndef(vars.subject);
    const text = strOrUndef(vars.text) ?? strOrUndef(vars.body);
    const html = strOrUndef(vars.html);

    if (!to || !subject || (!text && !html)) {
      // Producer didn't fully render the payload — surface as a hard
      // failure so the DLQ shows the missing-field pattern + we can
      // fix the producer migration in B5.
      throw new Error(
        `email payload missing required fields: to=${!!to} subject=${!!subject} text=${!!text} html=${!!html}`,
      );
    }

    // Resend's `emails.send` overload demands html OR text (or react)
    // and forbids passing the *other* keys as `undefined` under
    // exactOptionalPropertyTypes — branch explicitly per body shape.
    const response = await this.breaker.exec(async () => {
      if (html !== undefined) {
        return this.client!.emails.send({ from: this.from, to, subject, html });
      }
      return this.client!.emails.send({ from: this.from, to, subject, text: text! });
    });

    if (response.error) {
      logger.warn({ to, subject, err: response.error.message }, 'resend send returned error');
      throw new Error(`resend error: ${response.error.message}`);
    }

    logger.info({ to, subject, messageId: response.data?.id }, 'email sent');
    return true;
  }
}

function strOrUndef(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}
