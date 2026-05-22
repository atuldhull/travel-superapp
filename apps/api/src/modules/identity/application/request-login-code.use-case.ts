/**
 * Passwordless sign-in — step 1 (B1 phone / B2 email OTP). Mint a
 * 6-digit code for an email OR phone and deliver it. Mirrors
 * RequestMagicLinkUseCase: enumeration-safe (always resolves; never
 * reveals whether the destination is registered), soft rate-limited
 * (≤5 codes per destination per 15-min window).
 *
 * Channel routing: email → MailerPort, phone → SmsSender. For email
 * the destHash IS exactly User.emailHash (same sha256(pepper+email)),
 * so ConsumeLoginCodeUseCase can reuse findByEmailHash directly.
 *
 * Installed for Phase 1 — Onboarding & Identity.
 */
import { createHash, randomInt } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { Env } from '@app/config';
import { ConfigService } from '@nestjs/config';
import type { LoginChannel } from '../domain/login-code.entity';
import { LOGIN_CODE_REPOSITORY, type LoginCodeRepository } from './ports/login-code.repository';
import { MAILER_PORT, type MailerPort } from '../../../common/mailer/mailer.port';
import { SMS_SENDER, type SmsSender } from './ports/sms-sender.port';

const CODE_TTL_MS = 10 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX = 5;

export interface RequestLoginCodeCommand {
  readonly channel: LoginChannel;
  readonly destination: string;
}

/** email → lower/trim; phone → keep digits with an optional leading +. */
export function normalizeDestination(channel: LoginChannel, raw: string): string {
  if (channel === 'email') return raw.trim().toLowerCase();
  const cleaned = raw.replace(/[^\d+]/g, '');
  return cleaned.startsWith('+') ? `+${cleaned.slice(1).replace(/\+/g, '')}` : cleaned;
}

@Injectable()
export class RequestLoginCodeUseCase {
  constructor(
    @Inject(ConfigService) private readonly config: ConfigService<Env, true>,
    @Inject(LOGIN_CODE_REPOSITORY) private readonly codes: LoginCodeRepository,
    @Inject(MAILER_PORT) private readonly mailer: MailerPort,
    @Inject(SMS_SENDER) private readonly sms: SmsSender,
  ) {}

  async execute(cmd: RequestLoginCodeCommand): Promise<void> {
    const pepper = this.config.get('EMAIL_PEPPER', { infer: true }) as string;
    const dest = normalizeDestination(cmd.channel, cmd.destination);
    if (dest.length < 3) return; // malformed → silent no-op (no leak)
    const destHash = createHash('sha256').update(`${pepper}${dest}`).digest('hex');

    const recent = await this.codes.countRecent(destHash, RATE_LIMIT_WINDOW_MS);
    if (recent >= RATE_LIMIT_MAX) return;

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const codeHash = createHash('sha256').update(`${pepper}${code}`).digest('hex');
    await this.codes.create({
      channel: cmd.channel,
      destHash,
      codeHash,
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    });

    const appName =
      (this.config.get('EMAIL_FROM_NAME', { infer: true }) as string | undefined) ??
      'TravelSuperApp';
    const ttlMin = Math.round(CODE_TTL_MS / 60000);

    if (cmd.channel === 'email') {
      await this.mailer.send({
        to: dest,
        subject: `${appName} sign-in code: ${code}`,
        textBody: `Your ${appName} sign-in code is ${code}. It expires in ${ttlMin} minutes. If you didn't request this, ignore this email.`,
        htmlBody:
          `<div style="font-family:ui-sans-serif,system-ui;color:#1b2150">` +
          `<p>Your ${appName} sign-in code is:</p>` +
          `<p style="font-size:30px;font-weight:700;letter-spacing:6px;color:#7a5cff">${code}</p>` +
          `<p style="color:#667">Expires in ${ttlMin} minutes. If you didn't request this, you can ignore this email.</p>` +
          `</div>`,
      });
    } else {
      await this.sms.send({
        to: dest,
        body: `${appName}: your sign-in code is ${code} (valid ${ttlMin} min). Never share it.`,
      });
    }
  }
}
