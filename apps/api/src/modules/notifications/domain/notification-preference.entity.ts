/**
 * V.UX.26 — caller-owned notification preferences. One row per user
 * (unique on userId). The boolean flags gate global delivery channel;
 * `categoriesDisabled` is the per-category opt-out (categories are
 * derived from the templateId prefix at dispatch time).
 *
 * `lastDigestSentAt` is a write-side bookkeeping field consumed by
 * the weekly-digest scheduler — never exposed to clients.
 *
 * Installed by prompt [V.UX.26].
 */
export const NOTIFICATION_CATEGORIES = ['trip', 'safety', 'social', 'digest', 'account'] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export interface NotificationPreference {
  readonly id: string;
  readonly userId: string;
  readonly push: boolean;
  readonly email: boolean;
  readonly sms: boolean;
  readonly categoriesDisabled: readonly NotificationCategory[];
  readonly lastDigestSentAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
