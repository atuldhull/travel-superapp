/**
 * V.UX.26 — partial-update the caller's notification preferences.
 * Idempotent upsert (creates the row on first write).
 *
 * Installed by prompt [V.UX.26].
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  NOTIFICATION_PREFERENCE_REPOSITORY,
  type NotificationPreferenceRepository,
} from './ports/notification-preference.repository';
import type {
  NotificationCategory,
  NotificationPreference,
} from '../domain/notification-preference.entity';

export interface UpdateNotificationPreferencesCommand {
  readonly userId: string;
  readonly push?: boolean;
  readonly email?: boolean;
  readonly sms?: boolean;
  readonly categoriesDisabled?: readonly NotificationCategory[];
}

@Injectable()
export class UpdateNotificationPreferencesUseCase {
  constructor(
    @Inject(NOTIFICATION_PREFERENCE_REPOSITORY)
    private readonly repo: NotificationPreferenceRepository,
  ) {}

  execute(cmd: UpdateNotificationPreferencesCommand): Promise<NotificationPreference> {
    return this.repo.upsert({
      userId: cmd.userId,
      ...(cmd.push !== undefined ? { push: cmd.push } : {}),
      ...(cmd.email !== undefined ? { email: cmd.email } : {}),
      ...(cmd.sms !== undefined ? { sms: cmd.sms } : {}),
      ...(cmd.categoriesDisabled !== undefined
        ? { categoriesDisabled: cmd.categoriesDisabled }
        : {}),
    });
  }
}
