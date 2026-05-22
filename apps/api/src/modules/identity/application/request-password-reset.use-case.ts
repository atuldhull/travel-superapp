/**
 * V.UX.31 — request a password-reset email. Mirrors the magic-link
 * request shape exactly: always returns success (enumeration-safe),
 * soft rate-limit per email per 15-minute window, mints a 32-byte
 * hex token whose `sha256(EMAIL_PEPPER + token)` is persisted with a
 * 15-minute TTL.
 *
 * The plaintext token goes out only in the email link
 * (`${WEB_BASE_URL}/login/reset/${token}`). Even if the rest of the
 * DB leaks, the hashed column is useless — the attacker would still
 * need an active mailbox to receive a fresh token.
 *
 * Installed by prompt [V.UX.31].
 */
import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '@app/config';
import { hashEmail } from '../../../common/crypto/email-hash';
import { MAILER_PORT, type MailerPort } from './ports/mailer.port';
import {
  PASSWORD_RESET_TOKEN_REPOSITORY,
  type PasswordResetTokenRepository,
} from './ports/password-reset-token.repository';

const TOKEN_TTL_MS = 15 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX = 5;

export interface RequestPasswordResetCommand {
  readonly email: string;
}

@Injectable()
export class RequestPasswordResetUseCase {
  constructor(
    @Inject(ConfigService) private readonly config: ConfigService<Env, true>,
    @Inject(PASSWORD_RESET_TOKEN_REPOSITORY)
    private readonly tokens: PasswordResetTokenRepository,
    @Inject(MAILER_PORT) private readonly mailer: MailerPort,
  ) {}

  async execute(cmd: RequestPasswordResetCommand): Promise<void> {
    const emailNormalized = cmd.email.trim().toLowerCase();
    const emailHash = hashEmail(emailNormalized);
    const pepper = this.config.get('EMAIL_PEPPER', { infer: true }) as string;

    const recent = await this.tokens.countRecentForEmail(emailHash, RATE_LIMIT_WINDOW_MS);
    if (recent >= RATE_LIMIT_MAX) return;

    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(`${pepper}${token}`).digest('hex');
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
    await this.tokens.create({ emailHash, tokenHash, expiresAt });

    const webBaseUrl =
      (this.config.get('WEB_BASE_URL', { infer: true }) as string | undefined) ??
      'http://localhost:3001';
    const fromName =
      (this.config.get('EMAIL_FROM_NAME', { infer: true }) as string | undefined) ??
      'TravelSuperApp';
    const resetUrl = `${webBaseUrl.replace(/\/$/, '')}/login/reset/${token}`;
    await this.mailer.send({
      to: emailNormalized,
      subject: `Reset your ${fromName} password`,
      textBody:
        `Hi,\n\n` +
        `Click the link below to reset your ${fromName} password. ` +
        `It expires in 15 minutes and can only be used once.\n\n` +
        `${resetUrl}\n\n` +
        `If you didn't ask for this, you can safely ignore this email — your password ` +
        `won't change.\n`,
    });
  }
}
