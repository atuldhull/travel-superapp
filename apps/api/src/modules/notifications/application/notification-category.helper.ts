/**
 * V.UX.26 — maps a `templateKey` (the short machine name passed to
 * `NotificationSender.send()`) to one of the five
 * `NotificationCategory` buckets. The `categoriesDisabled` field
 * on `NotificationPreference` filters dispatches by this category.
 *
 * Unknown templates fall through to `account` — the safest default
 * (matches the catch-all behaviour of the inbox UI's category
 * selector).
 *
 * Installed by prompt [V.UX.26].
 */
import type { NotificationCategory } from '../domain/notification-preference.entity';

const PREFIX_TO_CATEGORY: Readonly<Record<string, NotificationCategory>> = {
  trip: 'trip',
  itinerary: 'trip',
  sos: 'safety',
  safety: 'safety',
  review: 'social',
  helpful: 'social',
  vote: 'social',
  weekly: 'digest',
  digest: 'digest',
  session: 'account',
  magic: 'account',
};

export function categoryFromTemplateKey(templateKey: string): NotificationCategory {
  const head = templateKey.split('_')[0] ?? '';
  return PREFIX_TO_CATEGORY[head] ?? 'account';
}
