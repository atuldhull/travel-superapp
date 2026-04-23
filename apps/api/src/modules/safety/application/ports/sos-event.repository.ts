/**
 * Port for SosEvent persistence. Three operations: create (with
 * PostGIS coord), list-mine, resolve-one-I-own.
 *
 * Resolve is scoped to `(id, userId)` — a stranger who guesses a
 * cuid can't mark someone else's SOS resolved. Returns `false` on
 * miss (either wrong id OR wrong owner) and the use-case maps it
 * to 404 `SOS_NOT_FOUND`. Same IDOR-defence policy as Trip
 * CRUD endpoints.
 *
 * Installed by prompt [IV.18.11.2].
 */
import type { SosEvent } from '../../domain/sos-event.entity';

export interface CreateSosInput {
  readonly userId: string;
  readonly trigger: string;
  readonly lat: number;
  readonly lng: number;
}

export interface ResolveSosInput {
  readonly id: string;
  readonly userId: string;
  readonly note: string | null;
}

export interface SosEventRepository {
  create(input: CreateSosInput): Promise<SosEvent>;
  /**
   * Most-recent-first list of the caller's own events. Includes
   * both active and resolved.
   */
  listForUser(userId: string, limit: number): Promise<readonly SosEvent[]>;
  /**
   * Flip `resolvedAt = now()` on the matching row. Scoped to
   * owner + still-unresolved — so a repeat resolve (or a stranger's
   * resolve) returns `null`, which the use-case maps to 404.
   */
  resolve(input: ResolveSosInput): Promise<SosEvent | null>;
}

export const SOS_EVENT_REPOSITORY = Symbol('SosEventRepository');
