/**
 * V.UX.13 — owner-scoped delete of a trusted contact. 404
 * `CONTACT_NOT_FOUND` collapses miss + wrong-owner so a stranger
 * guessing cuids learns nothing.
 *
 * Installed by prompt [V.UX.13].
 */
import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError } from '@app/errors';
import {
  TRUSTED_CONTACT_REPOSITORY,
  type TrustedContactRepository,
} from './ports/trusted-contact.repository';

export interface DeleteTrustedContactCommand {
  readonly userId: string;
  readonly id: string;
}

@Injectable()
export class DeleteTrustedContactUseCase {
  constructor(
    @Inject(TRUSTED_CONTACT_REPOSITORY) private readonly repo: TrustedContactRepository,
  ) {}

  async execute(cmd: DeleteTrustedContactCommand): Promise<void> {
    const removed = await this.repo.deleteForOwner(cmd.id, cmd.userId);
    if (!removed) {
      throw new NotFoundError(
        `Trusted contact not found: ${cmd.id}`,
        { id: cmd.id },
        'CONTACT_NOT_FOUND',
      );
    }
  }
}
