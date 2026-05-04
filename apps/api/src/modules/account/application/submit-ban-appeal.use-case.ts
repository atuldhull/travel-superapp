/**
 * V.UX.34 — submit a ban appeal. Unauthed (banned users can't
 * bearer-auth) — the request body carries the email + body. We
 * hash the email with EMAIL_PEPPER to find the user; if the user
 * doesn't exist OR isn't currently banned we silently 200 (no
 * enumeration leak). If the user IS banned we insert a BanAppeal
 * row in `pending` status.
 *
 * Soft rate-limit: at most 3 appeals per email per hour.
 *
 * Installed by prompt [V.UX.34].
 */
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '@app/config';
import { ValidationError } from '@app/errors';
import { PrismaService } from '../../../common/db/prisma.service';
import { hashEmail } from '../../identity/infrastructure/email-hash';

const BODY_MIN = 10;
const BODY_MAX = 2000;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 3;

export interface SubmitBanAppealCommand {
  readonly email: string;
  readonly body: string;
}

@Injectable()
export class SubmitBanAppealUseCase {
  constructor(
    @Inject(ConfigService) private readonly _config: ConfigService<Env, true>,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async execute(cmd: SubmitBanAppealCommand): Promise<void> {
    const trimmed = cmd.body.trim();
    if (trimmed.length < BODY_MIN || trimmed.length > BODY_MAX) {
      throw new ValidationError(
        `Appeal body must be ${BODY_MIN}..${BODY_MAX} characters`,
        { body: [`Must be ${BODY_MIN}..${BODY_MAX} characters`] },
        { min: BODY_MIN, max: BODY_MAX },
        'INVALID_APPEAL_BODY',
      );
    }
    const emailNormalized = cmd.email.trim().toLowerCase();
    const emailHash = hashEmail(emailNormalized);

    // Soft rate-limit per email per hour. Quietly return success
    // when over quota (matches password-reset / magic-link posture).
    const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
    const recent = await this.prisma.banAppeal.count({
      where: { emailHash, createdAt: { gte: since } },
    });
    if (recent >= RATE_LIMIT_MAX) return;

    const user = await this.prisma.user.findUnique({
      where: { emailHash },
      select: { id: true, bannedAt: true },
    });
    // Quietly return success for unknown / not-banned emails — don't
    // give an attacker a way to enumerate banned users.
    if (!user || user.bannedAt === null) return;

    await this.prisma.banAppeal.create({
      data: {
        userId: user.id,
        emailHash,
        body: trimmed,
      },
    });
  }
}
