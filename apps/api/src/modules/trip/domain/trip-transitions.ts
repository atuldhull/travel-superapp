/**
 * Pure-domain status-transition functions for `Trip`. The other half
 * of the [F4] DDD push — `Expense` got an entity class with a
 * `create()` factory; `Trip` keeps its persistence-shaped `interface
 * Trip` (Prisma row mirror) but the state-transition invariants
 * land here so the use-cases stop ad-hoc'ing them in line.
 *
 * Why functions instead of methods on a class: changing `interface
 * Trip` to a class would force every consumer that constructs a
 * Trip-shaped object literal (tests, fixtures, the Prisma adapter)
 * to mint via a static factory — broad, risky churn. The pure-
 * function form gives the same DDD benefit (invariants live in the
 * domain layer, not scattered across use-cases) without rewriting
 * the persistence model.
 *
 * Invariants:
 *
 *   I-LOCK    A trip can only transition status=draft → published
 *             ("locked"). An archived trip cannot be locked.
 *   I-UNLOCK  A trip can only transition status=published → draft.
 *             An archived trip cannot be unlocked.
 *   I-ARCHIVE A trip can only transition to archivedAt=now if it
 *             is not already archived (idempotent at the use-case
 *             layer is fine; the entity-level rule is "no double
 *             archive" which catches a real bug class — racing
 *             archive sweeps double-stamping a row).
 *   I-UNARCHIVE A trip can only transition to archivedAt=null if it
 *             IS currently archived (catches a "restore" attempt
 *             on a live trip).
 *
 * Each `assertCan*` throws `DomainError` on violation; each `mark*`
 * returns the post-transition Trip shape (immutable update). The
 * repo's UPDATE statement separately makes the change durable.
 *
 * Installed by [F4].
 */
import { ConflictError } from '@app/errors';
import type { Trip } from './trip.entity';

/** I-LOCK: throw if `trip` cannot transition to status=published. */
export function assertCanLock(trip: Trip): void {
  if (trip.archivedAt !== null) {
    throw new ConflictError(
      'Cannot lock an archived trip',
      { tripId: trip.id, archivedAt: trip.archivedAt.toISOString() },
      'TRIP_ARCHIVED',
    );
  }
  // status === 'published' is already locked — the use-case may
  // short-circuit (idempotent). We don't throw here so re-locking
  // is a no-op rather than a 409. The use-case keeps that policy
  // call ("if (trip.status === 'published') return trip").
}

/** I-UNLOCK: throw if `trip` cannot transition to status=draft. */
export function assertCanUnlock(trip: Trip): void {
  if (trip.archivedAt !== null) {
    throw new ConflictError(
      'Cannot unlock an archived trip',
      { tripId: trip.id, archivedAt: trip.archivedAt.toISOString() },
      'TRIP_ARCHIVED',
    );
  }
}

/** I-ARCHIVE: throw if `trip` is already soft-archived. */
export function assertCanArchive(trip: Trip): void {
  if (trip.archivedAt !== null) {
    throw new ConflictError(
      'Trip is already archived',
      { tripId: trip.id, archivedAt: trip.archivedAt.toISOString() },
      'TRIP_ALREADY_ARCHIVED',
    );
  }
}

/** I-UNARCHIVE: throw if `trip` is not currently archived. */
export function assertCanUnarchive(trip: Trip): void {
  if (trip.archivedAt === null) {
    throw new ConflictError('Trip is not archived', { tripId: trip.id }, 'TRIP_NOT_ARCHIVED');
  }
}

/** Pure transform: locked Trip (status=published). Caller persists. */
export function markLocked(trip: Trip, now: Date = new Date()): Trip {
  return { ...trip, status: 'published', updatedAt: now };
}

/** Pure transform: unlocked Trip (status=draft). Caller persists. */
export function markUnlocked(trip: Trip, now: Date = new Date()): Trip {
  return { ...trip, status: 'draft', updatedAt: now };
}

/** Pure transform: archived Trip (archivedAt stamped). Caller persists. */
export function markArchived(trip: Trip, now: Date = new Date()): Trip {
  return { ...trip, archivedAt: now, updatedAt: now };
}

/** Pure transform: unarchived Trip. Caller persists. */
export function markUnarchived(trip: Trip, now: Date = new Date()): Trip {
  return { ...trip, archivedAt: null, updatedAt: now };
}
