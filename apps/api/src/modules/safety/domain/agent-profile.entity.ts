/**
 * V.UX.24 — agent / local-guide caller-self surfaces.
 *
 * Splits intentionally:
 *   - `AgentProfile` is the editable row the agent owns (bio,
 *     languages, regions, displayName) plus the read-only KYC
 *     status + rating aggregates.
 *   - `AgentBookingSummary` is the dashboard's compact booking
 *     row — full EscrowHold has more fields than the agent UI
 *     needs.
 *   - `AgentEarningsSummary` collapses the booking list into a
 *     dashboard total + count.
 *   - `AgentReviewWithResponse` mirrors the existing Review row
 *     plus the V.UX.24 `responseBody` / `responseAt` reply.
 *
 * DDD refactor by [G4.2]: 4 update invariants moved off
 * `UpdateAgentProfileUseCase`:
 *   A1 displayName 1..AGENT_MAX_DISPLAY_CHARS chars (after trim)
 *   A2 bio ≤ AGENT_MAX_BIO_CHARS chars
 *   A3 languages ≤ AGENT_MAX_LIST entries, each 2..AGENT_MAX_ENTRY_CHARS chars
 *   A4 regions  ≤ AGENT_MAX_LIST entries, each 2..AGENT_MAX_ENTRY_CHARS chars
 *
 * There's no `static create()` — rows are seeded / admin-created, not
 * minted by a public use-case. `static validateUpdate(input)` handles
 * the partial-update flow + trims/coerces each present field;
 * `static fromPersistence(row)` wraps Prisma rows.
 *
 * Installed by prompt [V.UX.24]; entity-ized by [G4.2].
 */
import { ValidationError } from '@app/errors';

export type AgentKycStatus = 'pending' | 'verified' | 'rejected';
export const AGENT_KYC_STATUSES: readonly AgentKycStatus[] = ['pending', 'verified', 'rejected'];

export const AGENT_MAX_DISPLAY_CHARS = 120;
export const AGENT_MAX_BIO_CHARS = 2000;
export const AGENT_MAX_LIST = 20;
export const AGENT_MIN_ENTRY_CHARS = 2;
export const AGENT_MAX_ENTRY_CHARS = 40;

/** Update payload — every field optional; presence means "the caller
 *  wants to change this." Pass through `AgentProfile.validateUpdate()`
 *  to get a trimmed/coerced shape ready for the repo. */
export interface AgentProfileUpdateInput {
  readonly displayName?: string;
  readonly bio?: string | null;
  readonly languages?: readonly string[];
  readonly regions?: readonly string[];
}

/** Trimmed/coerced shape returned by `validateUpdate()`. */
export interface AgentProfileUpdatePatch {
  readonly displayName?: string;
  readonly bio?: string | null;
  readonly languages?: readonly string[];
  readonly regions?: readonly string[];
}

/** Row shape returned by the Prisma adapter. */
export interface AgentProfilePersistenceRow {
  readonly id: string;
  readonly userId: string;
  readonly displayName: string;
  readonly bio: string | null;
  readonly kycStatus: AgentKycStatus;
  readonly verifiedAt: Date | null;
  readonly languages: readonly string[];
  readonly regions: readonly string[];
  readonly ratingAverage: number;
  readonly ratingCount: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export class AgentProfile {
  readonly id: string;
  readonly userId: string;
  readonly displayName: string;
  readonly bio: string | null;
  readonly kycStatus: AgentKycStatus;
  readonly verifiedAt: Date | null;
  readonly languages: readonly string[];
  readonly regions: readonly string[];
  readonly ratingAverage: number;
  readonly ratingCount: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(row: AgentProfilePersistenceRow) {
    this.id = row.id;
    this.userId = row.userId;
    this.displayName = row.displayName;
    this.bio = row.bio;
    this.kycStatus = row.kycStatus;
    this.verifiedAt = row.verifiedAt;
    this.languages = row.languages;
    this.regions = row.regions;
    this.ratingAverage = row.ratingAverage;
    this.ratingCount = row.ratingCount;
    this.createdAt = row.createdAt;
    this.updatedAt = row.updatedAt;
  }

  /**
   * Validate a partial-update payload + return the trimmed/coerced
   * patch. Only the fields the caller actually passed are present in
   * the output — `undefined` stays `undefined`, `null` (for `bio`)
   * stays `null` (clear).
   *
   *   A1 displayName 1..AGENT_MAX_DISPLAY_CHARS chars (after trim)
   *   A2 bio ≤ AGENT_MAX_BIO_CHARS chars
   *   A3/A4 languages/regions ≤ AGENT_MAX_LIST entries, each
   *         AGENT_MIN_ENTRY_CHARS..AGENT_MAX_ENTRY_CHARS chars
   */
  static validateUpdate(input: AgentProfileUpdateInput): AgentProfileUpdatePatch {
    const patch: {
      -readonly [K in keyof AgentProfileUpdatePatch]: AgentProfileUpdatePatch[K];
    } = {};

    if (input.displayName !== undefined) {
      const trimmed = input.displayName.trim();
      if (trimmed.length === 0 || trimmed.length > AGENT_MAX_DISPLAY_CHARS) {
        throw new ValidationError(
          `displayName must be 1..${AGENT_MAX_DISPLAY_CHARS} chars`,
          { displayName: ['out of range'] },
          { length: trimmed.length },
          'INVALID_AGENT_DISPLAY_NAME',
        );
      }
      patch.displayName = trimmed;
    }

    if (input.bio !== undefined) {
      if (input.bio === null) {
        patch.bio = null;
      } else {
        const trimmed = input.bio.trim();
        if (trimmed.length > AGENT_MAX_BIO_CHARS) {
          throw new ValidationError(
            `bio must be ≤ ${AGENT_MAX_BIO_CHARS} chars`,
            { bio: ['too long'] },
            { length: trimmed.length },
            'INVALID_AGENT_BIO',
          );
        }
        patch.bio = trimmed;
      }
    }

    for (const field of ['languages', 'regions'] as const) {
      const list = input[field];
      if (list === undefined) continue;
      if (list.length > AGENT_MAX_LIST) {
        throw new ValidationError(
          `${field} must have ≤ ${AGENT_MAX_LIST} entries`,
          { [field]: ['too many'] },
          { count: list.length },
          'INVALID_AGENT_LIST',
        );
      }
      const trimmed: string[] = [];
      for (const entry of list) {
        const t = entry.trim();
        if (t.length < AGENT_MIN_ENTRY_CHARS || t.length > AGENT_MAX_ENTRY_CHARS) {
          throw new ValidationError(
            `each ${field} entry must be ${AGENT_MIN_ENTRY_CHARS}..${AGENT_MAX_ENTRY_CHARS} chars`,
            { [field]: ['entry out of range'] },
            { entry, length: t.length },
            'INVALID_AGENT_LIST',
          );
        }
        trimmed.push(t);
      }
      patch[field] = trimmed;
    }

    return patch;
  }

  /** Wrap a persisted row in an `AgentProfile` instance. */
  static fromPersistence(row: AgentProfilePersistenceRow): AgentProfile {
    return new AgentProfile(row);
  }
}

export type AgentEscrowState = 'held' | 'released' | 'refunded' | 'disputed';

export interface AgentBookingSummary {
  readonly id: string;
  readonly userId: string;
  readonly amountUsd: string; // Prisma Decimal → 2-decimal string.
  readonly currency: string;
  readonly state: AgentEscrowState;
  readonly heldAt: Date;
  readonly releasedAt: Date | null;
  readonly refundedAt: Date | null;
}

export interface AgentEarningsSummary {
  readonly grossUsd: string; // 2-decimal string.
  readonly bookingsCount: number;
}

export interface AgentReviewWithResponse {
  readonly id: string;
  readonly authorId: string;
  readonly rating: number;
  readonly body: string;
  readonly language: string;
  readonly verifiedBooking: boolean;
  readonly responseBody: string | null;
  readonly responseAt: Date | null;
  readonly createdAt: Date;
}
