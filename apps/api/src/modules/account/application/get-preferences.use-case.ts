/**
 * V.UX.14 — return the caller's preferences (or a synthetic
 * default if they've never written any). Always succeeds for an
 * authenticated user.
 *
 * Installed by prompt [V.UX.14].
 */
import { Inject, Injectable } from '@nestjs/common';
import type { Preferences } from '../domain/preferences.entity';
import { PREFERENCES_REPOSITORY, type PreferencesRepository } from './ports/preferences.repository';

@Injectable()
export class GetPreferencesUseCase {
  constructor(@Inject(PREFERENCES_REPOSITORY) private readonly repo: PreferencesRepository) {}

  async execute(userId: string): Promise<Preferences> {
    return this.repo.getOrDefault(userId);
  }
}
