/**
 * POST.3 — Resend mailer adapter (real outbound email).
 *
 * Wraps the Resend HTTP API. Activated by the IdentityModule
 * factory when both `RESEND_API_KEY` and `EMAIL_FROM_ADDRESS`
 * resolve at boot — otherwise the stub adapter wins.
 *
 * Behaviour:
 *   - From-address built from `EMAIL_FROM_NAME` + `EMAIL_FROM_ADDRESS`
 *     in classic "Name <a@b.com>" RFC-5322 form.
 *   - HTML body is required by Resend; we synthesise a minimal one
 *     from `textBody` when consumers haven't provided HTML so the
 *     port shape stays unchanged.
 *   - Failures throw a `MailDeliveryError` (a DomainError subclass)
 *     so the use-case can either surface to the user or swallow
 *     (account-deletion-pending swallows; magic-link surfaces).
 *   - Rate-limiting + retries are NOT done here. Resend's free tier
 *     is 3k/mo + ~10/sec; if a slice ever bursts past that the
 *     wrapping use-case should queue.
 *
 * Installed by prompt [POST.3].
 */
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import type { Env } from '@app/config';
import { DomainError } from '@app/errors';
import { createLogger, type AppLogger } from '@app/logger';
import { CLOCK, type Clock } from '@app/clock';
import type { MailMessage, MailerPort } from './mailer.port';

/** Thrown when Resend rejects a send. The wrapping use-case decides
 *  whether to surface (magic-link request) or swallow (account-
 *  deletion-pending notification). */
export class MailDeliveryError extends DomainError {
  public readonly code = 'MAIL_DELIVERY_FAILED';
  public readonly httpStatus = 502;
  constructor(message: string, providerError?: string) {
    super(message, providerError !== undefined ? { providerError } : {});
  }
}

@Injectable()
export class ResendMailerAdapter implements MailerPort {
  private readonly client: Resend;
  private readonly fromAddress: string;
  private readonly logger: AppLogger = createLogger('resend-mailer');

  constructor(
    @Inject(ConfigService) config: ConfigService<Env, true>,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {
    const apiKey = config.get('RESEND_API_KEY', { infer: true });
    if (!apiKey) {
      // Should never happen — the IdentityModule factory only
      // instantiates this adapter when the key is set.
      throw new Error('ResendMailerAdapter requires RESEND_API_KEY env var');
    }
    this.client = new Resend(apiKey);
    const fromName = config.get('EMAIL_FROM_NAME', { infer: true });
    const fromEmail = config.get('EMAIL_FROM_ADDRESS', { infer: true });
    // RFC 5322 "Name <addr@domain>" form — Resend accepts this directly.
    this.fromAddress = `${fromName} <${fromEmail}>`;
  }

  async send(message: MailMessage): Promise<void> {
    const html = message.htmlBody ?? this.synthesiseHtmlFromText(message.textBody);
    const startedAt = this.clock.nowMs();
    try {
      const result = await this.client.emails.send({
        from: this.fromAddress,
        to: message.to,
        subject: message.subject,
        text: message.textBody,
        html,
      });
      // Resend SDK shape: { data: { id }, error: null } on success;
      // { data: null, error: { message, name, statusCode } } on failure.
      if (result.error) {
        const providerMsg = result.error.message ?? String(result.error);
        this.logger.warn(
          { to: message.to, subject: message.subject, providerMsg },
          'resend_mailer_send_failed',
        );
        throw new MailDeliveryError('Resend rejected the message', providerMsg);
      }
      this.logger.info(
        {
          to: message.to,
          subject: message.subject,
          messageId: result.data?.id ?? null,
          latencyMs: this.clock.nowMs() - startedAt,
        },
        'resend_mailer_send_ok',
      );
    } catch (err) {
      if (err instanceof MailDeliveryError) throw err;
      const providerMsg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        { to: message.to, subject: message.subject, providerMsg },
        'resend_mailer_send_threw',
      );
      throw new MailDeliveryError('Resend transport error', providerMsg);
    }
  }

  /** Minimal text-to-HTML synthesis when the caller didn't provide
   *  an HTML body. Escapes HTML entities + wraps line breaks in <p>
   *  tags. Keeps the body deliverable-friendly (Resend requires html
   *  for many provider acceptance heuristics). */
  private synthesiseHtmlFromText(text: string): string {
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
    const paragraphs = escaped
      .split(/\n\n+/g)
      .map((p) => `<p>${p.replace(/\n/g, '<br/>')}</p>`)
      .join('');
    return `<!doctype html><html><body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:24px auto;padding:0 16px;line-height:1.55;color:#0f172a">${paragraphs}</body></html>`;
  }
}
