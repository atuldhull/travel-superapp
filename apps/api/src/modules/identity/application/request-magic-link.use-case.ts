/**
 * Request a passwordless sign-in link. Always returns success — the
 * api intentionally does NOT reveal whether the email is registered
 * (privacy + enumeration defence). Real users get a deliverable
 * email; non-users get nothing (the email goes to the void).
 *
 * Flow:
 *   1. Hash the email with `EMAIL_PEPPER` (same hash User.emailHash uses).
 *   2. Soft rate-limit: at most N tokens per email per 15-minute window.
 *      Over-quota requests return success without minting.
 *   3. Mint a fresh 32-byte hex token; persist `sha256(EMAIL_PEPPER +
 *      token)` with a 15-minute TTL.
 *   4. Build the magic URL: `${WEB_BASE_URL}/auth/magic-link/${token}`.
 *   5. Send via the configured `MailerPort` (stub or real).
 *
 * Idempotency / collisions: token uniqueness is enforced at the DB
 * level (`tokenHash @unique`); 32 bytes of entropy makes a collision
 * astronomically unlikely.
 *
 * Installed by prompt [V.UX.2].
 */
import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { Env } from '@app/config';
import { ConfigService } from '@nestjs/config';
import {
  MAGIC_LINK_TOKEN_REPOSITORY,
  type MagicLinkTokenRepository,
} from './ports/magic-link-token.repository';
import { MAILER_PORT, type MailerPort } from '../../../common/mailer/mailer.port';
import { magicLinkEmail } from './email-templates';

const TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX = 5;

export interface RequestMagicLinkCommand {
  readonly email: string;
}

@Injectable()
export class RequestMagicLinkUseCase {
  constructor(
    @Inject(ConfigService) private readonly config: ConfigService<Env, true>,
    @Inject(MAGIC_LINK_TOKEN_REPOSITORY)
    private readonly tokens: MagicLinkTokenRepository,
    @Inject(MAILER_PORT) private readonly mailer: MailerPort,
  ) {}

  async execute(cmd: RequestMagicLinkCommand): Promise<void> {
    const emailNormalized = cmd.email.trim().toLowerCase();
    const pepper = this.config.get('EMAIL_PEPPER', { infer: true }) as string;
    const emailHash = createHash('sha256').update(`${pepper}${emailNormalized}`).digest('hex');

    // Soft rate-limit: enumeration attacker would mint many tokens for a
    // single address. Cap at N per 15-min window. Over-quota → silently
    // skip mint + skip send (still return success to caller).
    const recent = await this.tokens.countRecentForEmail(emailHash, RATE_LIMIT_WINDOW_MS);
    if (recent >= RATE_LIMIT_MAX) return;

    // 32 bytes hex → 64 chars; URL-safe (no padding).
    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(`${pepper}${token}`).digest('hex');
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
    await this.tokens.create({ emailHash, tokenHash, expiresAt });

    // Default to the web dev port (:3002). The schema default is
    // :3001, which on this stack is the Docker observability stack
    // (Grafana) — an unset WEB_BASE_URL there made sign-in emails
    // open Grafana. .env now sets this explicitly; the fallback is
    // also corrected for safety.
    const webBaseUrl =
      (this.config.get('WEB_BASE_URL', { infer: true }) as string | undefined) ??
      'http://localhost:3002';
    const fromName =
      (this.config.get('EMAIL_FROM_NAME', { infer: true }) as string | undefined) ??
      'TravelSuperApp';

    const magicUrl = `${webBaseUrl.replace(/\/$/, '')}/auth/magic-link/${token}`;
    const ttlMinutes = Math.round(TOKEN_TTL_MS / 60000);
    const email = magicLinkEmail({ appName: fromName, magicUrl, ttlMinutes });
    await this.mailer.send({
      to: emailNormalized,
      subject: email.subject,
      textBody: email.textBody,
      htmlBody: email.htmlBody,
    });
  }
}
