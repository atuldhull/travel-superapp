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
import { TrustedContact } from '../domain/trusted-contact.entity';
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
    // Domain-side invariants (C1-C5 — [G4.3]). Trim/coerce + the
    // "channel required" rule live on the entity now.
    const input = TrustedContact.create(cmd);

    // Per-user cap stays here — needs the repo to count siblings.
    const count = await this.repo.countForUser(input.userId);
    if (count >= MAX_CONTACTS_PER_USER) {
      throw new ValidationError(
        `At most ${MAX_CONTACTS_PER_USER} trusted contacts per account`,
        { contacts: [`max ${MAX_CONTACTS_PER_USER}`] },
        { current: count, cap: MAX_CONTACTS_PER_USER },
        'CONTACT_LIMIT_REACHED',
      );
    }

    return this.repo.create(input);
  }
}
