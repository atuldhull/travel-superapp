/**
 * V.UX.26 — read the caller's notification preferences row.
 * Returns a defaults-shape when the user has never written one.
 *
 * Installed by prompt [V.UX.26].
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  NOTIFICATION_PREFERENCE_REPOSITORY,
  type NotificationPreferenceRepository,
} from './ports/notification-preference.repository';
import type { NotificationPreference } from '../domain/notification-preference.entity';

@Injectable()
export class GetNotificationPreferencesUseCase {
  constructor(
    @Inject(NOTIFICATION_PREFERENCE_REPOSITORY)
    private readonly repo: NotificationPreferenceRepository,
  ) {}

  execute(userId: string): Promise<NotificationPreference> {
    return this.repo.getOrDefault(userId);
  }
}
