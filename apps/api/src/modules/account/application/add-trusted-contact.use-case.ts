/**
 * V.UX.13 — add a pre-set safety contact. Cap of 3 per user
 * (matches MfaBackupCode's per-user pattern). At least one of
 * `phone` or `email` must be set so the SOS fan-out has a channel
 * to reach them on.
 *
 * Installed by prompt [V.UX.13].
 */
import { Inject, Injectable } from '@nestjs/common';
import { ValidationError } from '@app/errors';
import type { TrustedContact } from '../domain/trusted-contact.entity';
import {
  TRUSTED_CONTACT_REPOSITORY,
  type TrustedContactRepository,
} from './ports/trusted-contact.repository';

const MAX_CONTACTS_PER_USER = 3;

export interface AddTrustedContactCommand {
  readonly userId: string;
  readonly name: string;
  readonly phone: string | null;
  readonly email: string | null;
}

@Injectable()
export class AddTrustedContactUseCase {
  constructor(
    @Inject(TRUSTED_CONTACT_REPOSITORY) private readonly repo: TrustedContactRepository,
  ) {}

  async execute(cmd: AddTrustedContactCommand): Promise<TrustedContact> {
    const phone = cmd.phone?.trim() ? cmd.phone.trim() : null;
    const email = cmd.email?.trim() ? cmd.email.trim() : null;
    if (!phone && !email) {
      throw new ValidationError(
        'A trusted contact needs at least a phone or an email',
        { phone: ['or email is required'], email: ['or phone is required'] },
        {},
        'CONTACT_CHANNEL_REQUIRED',
      );
    }

    const count = await this.repo.countForUser(cmd.userId);
    if (count >= MAX_CONTACTS_PER_USER) {
      throw new ValidationError(
        `At most ${MAX_CONTACTS_PER_USER} trusted contacts per account`,
        { contacts: [`max ${MAX_CONTACTS_PER_USER}`] },
        { current: count, cap: MAX_CONTACTS_PER_USER },
        'CONTACT_LIMIT_REACHED',
      );
    }

    return this.repo.create({
      userId: cmd.userId,
      name: cmd.name.trim(),
      phone,
      email,
    });
  }
}
