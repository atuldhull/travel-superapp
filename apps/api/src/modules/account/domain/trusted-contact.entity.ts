/**
 * V.UX.13 — pre-set safety contact. On SOS trigger the
 * NOTIFY_CONTACTS_PORT fans out a "your traveler triggered SOS at
 * <coords>" message to each row. At least one of `phone` or `email`
 * must be set (the use-case enforces it; null-on-both is rejected
 * before persistence).
 *
 * Installed by prompt [V.UX.13].
 */
export interface TrustedContact {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly phone: string | null;
  readonly email: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
