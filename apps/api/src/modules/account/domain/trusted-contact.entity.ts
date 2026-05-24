/**
 * V.UX.13 — pre-set safety contact. On SOS trigger the
 * NOTIFY_CONTACTS_PORT fans out a "your traveler triggered SOS at
 * <coords>" message to each row.
 *
 * DDD refactor by [G4.3]:
 *   C1 userId non-empty
 *   C2 name non-empty + ≤ TRUSTED_CONTACT_MAX_NAME_CHARS after trim
 *   C3 at least one of phone / email must be non-null after trim
 *     (the "channel required" rule that drives the SOS fan-out)
 *   C4 phone trimmed-to-null when blank, ≤ 32 chars
 *   C5 email trimmed-to-null when blank, ≤ 254 chars (RFC 5321)
 *     + contains a `@`
 *
 * The MAX_CONTACTS_PER_USER cap stays in the use-case because it
 * needs the repository to count siblings.
 *
 * Installed by prompt [V.UX.13]; entity-ized by [G4.3].
 */
import { ValidationError } from '@app/errors';

export const TRUSTED_CONTACT_MAX_NAME_CHARS = 120;
export const TRUSTED_CONTACT_MAX_PHONE_CHARS = 32;
export const TRUSTED_CONTACT_MAX_EMAIL_CHARS = 254;

/** Input shape for `TrustedContact.create()` — the new-contact
 *  payload BEFORE the DB assigns id + timestamps. */
export interface CreateTrustedContactInput {
  readonly userId: string;
  readonly name: string;
  readonly phone: string | null;
  readonly email: string | null;
}

/** Row shape returned by the Prisma adapter. */
export interface TrustedContactPersistenceRow {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly phone: string | null;
  readonly email: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export class TrustedContact {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly phone: string | null;
  readonly email: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(row: TrustedContactPersistenceRow) {
    this.id = row.id;
    this.userId = row.userId;
    this.name = row.name;
    this.phone = row.phone;
    this.email = row.email;
    this.createdAt = row.createdAt;
    this.updatedAt = row.updatedAt;
  }

  /**
   * Validate + return a trimmed/coerced CreateTrustedContactInput
   * ready for `TrustedContactRepository.create()`. Throws
   * `ValidationError` on any invariant break.
   *
   *   C1 userId non-empty
   *   C2 name non-empty + ≤ TRUSTED_CONTACT_MAX_NAME_CHARS after trim
   *   C3 phone OR email non-null after trim (channel required)
   *   C4 phone (when set) ≤ TRUSTED_CONTACT_MAX_PHONE_CHARS
   *   C5 email (when set) ≤ TRUSTED_CONTACT_MAX_EMAIL_CHARS + contains @
   */
  static create(input: CreateTrustedContactInput): CreateTrustedContactInput {
    if (typeof input.userId !== 'string' || input.userId.length === 0) {
      throw new ValidationError(
        'userId must be a non-empty string',
        { userId: ['must be non-empty'] },
        {},
        'INVALID_TRUSTED_CONTACT',
      );
    }
    const name = input.name.trim();
    if (name.length === 0 || name.length > TRUSTED_CONTACT_MAX_NAME_CHARS) {
      throw new ValidationError(
        `name must be 1..${TRUSTED_CONTACT_MAX_NAME_CHARS} chars (after trim)`,
        { name: ['out of range'] },
        { length: name.length },
        'INVALID_TRUSTED_CONTACT',
      );
    }
    const phone = input.phone && input.phone.trim().length > 0 ? input.phone.trim() : null;
    const email = input.email && input.email.trim().length > 0 ? input.email.trim() : null;
    if (!phone && !email) {
      throw new ValidationError(
        'A trusted contact needs at least a phone or an email',
        { phone: ['or email is required'], email: ['or phone is required'] },
        {},
        'CONTACT_CHANNEL_REQUIRED',
      );
    }
    if (phone && phone.length > TRUSTED_CONTACT_MAX_PHONE_CHARS) {
      throw new ValidationError(
        `phone must be ≤ ${TRUSTED_CONTACT_MAX_PHONE_CHARS} chars`,
        { phone: ['too long'] },
        { length: phone.length },
        'INVALID_TRUSTED_CONTACT',
      );
    }
    if (email && (email.length > TRUSTED_CONTACT_MAX_EMAIL_CHARS || !email.includes('@'))) {
      throw new ValidationError(
        'email is malformed or too long',
        { email: ['invalid'] },
        { length: email.length },
        'INVALID_TRUSTED_CONTACT',
      );
    }
    return { userId: input.userId, name, phone, email };
  }

  /** Wrap a persisted row in a `TrustedContact` instance. */
  static fromPersistence(row: TrustedContactPersistenceRow): TrustedContact {
    return new TrustedContact(row);
  }
}
