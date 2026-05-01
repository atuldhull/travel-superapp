/**
 * Port for the caller-owned notification preferences row.
 *
 * `getOrDefault` synthesises a defaults-shape when the user has
 * never written one — same pattern as `PreferencesRepository.getOrDefault`
 * in the account module.
 *
 * `upsert` partial-applies whatever fields are present; missing
 * fields are left untouched.
 *
 * `markDigestSent` is a side-channel used by the weekly digest
 * scheduler to advance `lastDigestSentAt` after a successful tick.
 *
 * Installed by prompt [V.UX.26].
 */
import type {
  NotificationCategory,
  NotificationPreference,
} from '../../domain/notification-preference.entity';

export interface UpsertNotificationPreferenceInput {
  readonly userId: string;
  readonly push?: boolean;
  readonly email?: boolean;
  readonly sms?: boolean;
  readonly categoriesDisabled?: readonly NotificationCategory[];
}

export interface NotificationPreferenceRepository {
  getOrDefault(userId: string): Promise<NotificationPreference>;
  upsert(input: UpsertNotificationPreferenceInput): Promise<NotificationPreference>;
  markDigestSent(userId: string, at: Date): Promise<void>;
  /** All users who have written a row + are NOT digest-opted-out.
   *  The scheduler narrows further by per-user timezone. */
  listEligibleForDigest(): Promise<readonly NotificationPreference[]>;
}

export const NOTIFICATION_PREFERENCE_REPOSITORY = Symbol('NotificationPreferenceRepository');
