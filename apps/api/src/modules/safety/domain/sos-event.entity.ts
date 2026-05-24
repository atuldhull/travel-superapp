/**
 * `SosEvent` domain entity. Mirrors the Prisma row minus the PostGIS
 * `coordinates` column. `trigger` is a free-form string so new
 * trigger modes (`fall_detected`, `geofence_exit`, `manual_tap`,
 * `voice_command`) don't need a schema migration.
 *
 * `resolvedAt` is null on create; flipping it (with an optional
 * note) is a separate write path. An unresolved event is "active"
 * — the UI/dashboard filters on that.
 *
 * DDD refactor by [G4.2]: 2 invariants moved off `TriggerSosUseCase`:
 *   O1 userId non-empty
 *   O2 trigger non-empty + ≤ 60 chars (after trim)
 *
 * lat/lng range checks stay in the use-case — they're a geo concern
 * and the entity intentionally has no coordinates field.
 *
 * Installed by prompt [IV.18.11.2]; entity-ized by [G4.2].
 */
import { ValidationError } from '@app/errors';

export const SOS_MAX_TRIGGER_LENGTH = 60;
export const SOS_MAX_RESOLUTION_NOTE_LENGTH = 2000;

/** Input shape for `SosEvent.create()` — payload to pass to
 *  `SosEventRepository.create()` (lat/lng added at the use-case
 *  boundary). */
export interface CreateSosEventInput {
  readonly userId: string;
  readonly trigger: string;
}

/** Row shape returned by the Prisma adapter. */
export interface SosEventPersistenceRow {
  readonly id: string;
  readonly userId: string;
  readonly trigger: string;
  readonly resolvedAt: Date | null;
  readonly resolutionNote: string | null;
  readonly createdAt: Date;
}

export class SosEvent {
  readonly id: string;
  readonly userId: string;
  readonly trigger: string;
  readonly resolvedAt: Date | null;
  readonly resolutionNote: string | null;
  readonly createdAt: Date;

  private constructor(row: SosEventPersistenceRow) {
    this.id = row.id;
    this.userId = row.userId;
    this.trigger = row.trigger;
    this.resolvedAt = row.resolvedAt;
    this.resolutionNote = row.resolutionNote;
    this.createdAt = row.createdAt;
  }

  /**
   * Validate + return a normalised CreateSosEventInput ready for
   * `SosEventRepository.create()`. Throws `ValidationError` on any
   * invariant break.
   */
  static create(input: CreateSosEventInput): CreateSosEventInput {
    if (typeof input.userId !== 'string' || input.userId.length === 0) {
      throw new ValidationError(
        'userId must be a non-empty string',
        { userId: ['must be non-empty'] },
        {},
        'INVALID_SOS_EVENT',
      );
    }
    const trigger = input.trigger.trim();
    if (trigger.length === 0 || trigger.length > SOS_MAX_TRIGGER_LENGTH) {
      throw new ValidationError(
        `trigger must be 1..${SOS_MAX_TRIGGER_LENGTH} chars (after trim)`,
        { trigger: ['out of range'] },
        { length: trigger.length },
        'INVALID_SOS_EVENT',
      );
    }
    return { userId: input.userId, trigger };
  }

  /** Validate the resolution note used when an admin/owner resolves
   *  an SOS event. Empty/whitespace → null (caller can store null). */
  static normaliseResolutionNote(note: string | null | undefined): string | null {
    if (note === null || note === undefined) return null;
    const trimmed = note.trim();
    if (trimmed.length === 0) return null;
    if (trimmed.length > SOS_MAX_RESOLUTION_NOTE_LENGTH) {
      throw new ValidationError(
        `resolutionNote must be ≤ ${SOS_MAX_RESOLUTION_NOTE_LENGTH} chars`,
        { resolutionNote: ['too long'] },
        { length: trimmed.length },
        'INVALID_SOS_EVENT',
      );
    }
    return trimmed;
  }

  /** Wrap a persisted row in a `SosEvent` instance. */
  static fromPersistence(row: SosEventPersistenceRow): SosEvent {
    return new SosEvent(row);
  }
}
