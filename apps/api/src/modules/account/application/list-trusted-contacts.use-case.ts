/**
 * V.UX.13 — list the caller's pre-set safety contacts.
 *
 * Installed by prompt [V.UX.13].
 */
import { Inject, Injectable } from '@nestjs/common';
import type { TrustedContact } from '../domain/trusted-contact.entity';
import {
  TRUSTED_CONTACT_REPOSITORY,
  type TrustedContactRepository,
} from './ports/trusted-contact.repository';

@Injectable()
export class ListTrustedContactsUseCase {
  constructor(
    @Inject(TRUSTED_CONTACT_REPOSITORY) private readonly repo: TrustedContactRepository,
  ) {}

  async execute(userId: string): Promise<readonly TrustedContact[]> {
    return this.repo.listForUser(userId);
  }
}
