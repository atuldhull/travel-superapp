/**
 * V.UX.13 — port for TrustedContact persistence. Owner-scoped CRUD
 * (the cap of 3 per user is enforced in the use-case via
 * `countForUser`, not at the DB layer — same pattern as
 * MfaBackupCode).
 *
 * Installed by prompt [V.UX.13].
 */
import type { TrustedContact } from '../../domain/trusted-contact.entity';

export interface CreateTrustedContactInput {
  readonly userId: string;
  readonly name: string;
  readonly phone: string | null;
  readonly email: string | null;
}

export interface TrustedContactRepository {
  /** Most-recent-first list of the caller's contacts. */
  listForUser(userId: string): Promise<readonly TrustedContact[]>;
  /** Cheap counter used to enforce the 3-contact cap in the use-case. */
  countForUser(userId: string): Promise<number>;
  create(input: CreateTrustedContactInput): Promise<TrustedContact>;
  /**
   * Owner-scoped delete. Returns `true` iff a row matching
   * `(id, userId)` was actually removed — a stranger guessing a
   * cuid silently no-ops, which the use-case maps to 404.
   */
  deleteForOwner(id: string, userId: string): Promise<boolean>;
}

export const TRUSTED_CONTACT_REPOSITORY = Symbol('TrustedContactRepository');
