/**
 * Unit tests for `apps/api/src/modules/trip/domain/trip-transitions.ts`
 * — the [F4] DDD push for Trip's status / archive invariants. Pure
 * domain tests: no DB, no Nest.
 */
import { ConflictError } from '@app/errors';
import {
  assertCanArchive,
  assertCanLock,
  assertCanUnarchive,
  assertCanUnlock,
  markArchived,
  markLocked,
  markUnarchived,
  markUnlocked,
} from '../src/modules/trip/domain/trip-transitions';
import type { Trip, TripStatus } from '../src/modules/trip/domain/trip.entity';

function trip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: 'trip_1',
    userId: 'user_alice',
    title: 'Paris',
    status: 'draft' as TripStatus,
    radiusKm: 5,
    startsOn: null,
    endsOn: null,
    version: 1,
    archivedAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('trip-transitions (unit)', () => {
  describe('assertCanLock', () => {
    it('allows a draft trip to be locked', () => {
      expect(() => assertCanLock(trip({ status: 'draft' }))).not.toThrow();
    });
    it('allows an already-published trip (idempotent caller decides)', () => {
      expect(() => assertCanLock(trip({ status: 'published' }))).not.toThrow();
    });
    it('throws TRIP_ARCHIVED on an archived trip', () => {
      try {
        assertCanLock(trip({ archivedAt: new Date('2026-04-01') }));
      } catch (err) {
        expect(err).toBeInstanceOf(ConflictError);
        expect((err as ConflictError).code).toBe('TRIP_ARCHIVED');
        return;
      }
      throw new Error('expected throw');
    });
  });

  describe('assertCanUnlock', () => {
    it('allows a published trip to be unlocked', () => {
      expect(() => assertCanUnlock(trip({ status: 'published' }))).not.toThrow();
    });
    it('throws TRIP_ARCHIVED on an archived trip', () => {
      try {
        assertCanUnlock(trip({ archivedAt: new Date('2026-04-01') }));
      } catch (err) {
        expect((err as ConflictError).code).toBe('TRIP_ARCHIVED');
        return;
      }
      throw new Error('expected throw');
    });
  });

  describe('assertCanArchive', () => {
    it('allows a live trip to be archived', () => {
      expect(() => assertCanArchive(trip({ archivedAt: null }))).not.toThrow();
    });
    it('throws TRIP_ALREADY_ARCHIVED on a soft-archived trip', () => {
      try {
        assertCanArchive(trip({ archivedAt: new Date('2026-04-01') }));
      } catch (err) {
        expect((err as ConflictError).code).toBe('TRIP_ALREADY_ARCHIVED');
        return;
      }
      throw new Error('expected throw');
    });
  });

  describe('assertCanUnarchive', () => {
    it('allows an archived trip to be unarchived', () => {
      expect(() => assertCanUnarchive(trip({ archivedAt: new Date('2026-04-01') }))).not.toThrow();
    });
    it('throws TRIP_NOT_ARCHIVED on a live trip', () => {
      try {
        assertCanUnarchive(trip({ archivedAt: null }));
      } catch (err) {
        expect((err as ConflictError).code).toBe('TRIP_NOT_ARCHIVED');
        return;
      }
      throw new Error('expected throw');
    });
  });

  describe('mark* pure transforms', () => {
    const now = new Date('2026-06-01T00:00:00Z');

    it('markLocked sets status=published and bumps updatedAt', () => {
      const out = markLocked(trip({ status: 'draft' }), now);
      expect(out.status).toBe('published');
      expect(out.updatedAt).toEqual(now);
    });
    it('markUnlocked sets status=draft and bumps updatedAt', () => {
      const out = markUnlocked(trip({ status: 'published' }), now);
      expect(out.status).toBe('draft');
      expect(out.updatedAt).toEqual(now);
    });
    it('markArchived stamps archivedAt + updatedAt to the same instant', () => {
      const out = markArchived(trip({ archivedAt: null }), now);
      expect(out.archivedAt).toEqual(now);
      expect(out.updatedAt).toEqual(now);
    });
    it('markUnarchived clears archivedAt and bumps updatedAt', () => {
      const out = markUnarchived(trip({ archivedAt: new Date('2026-04-01') }), now);
      expect(out.archivedAt).toBeNull();
      expect(out.updatedAt).toEqual(now);
    });

    it('every mark* is immutable (returns a new object)', () => {
      const original = trip({ status: 'draft' });
      const out = markLocked(original, now);
      expect(out).not.toBe(original);
      expect(original.status).toBe('draft');
    });

    it('default `now` parameter stamps a fresh Date (covers default branch)', () => {
      // [H1] coverage gate caught these as 50%-branch uncovered: each
      // mark* function has `now: Date = new Date()`; the test suite
      // above always passes `now` explicitly. Exercise the default
      // path so the gate stays at 100%.
      const before = Date.now();
      const a = markLocked(trip({ status: 'draft' }));
      const b = markUnlocked(trip({ status: 'published' }));
      const c = markArchived(trip({ archivedAt: null }));
      const d = markUnarchived(trip({ archivedAt: new Date('2026-04-01') }));
      const after = Date.now();
      for (const out of [a, b, c, d]) {
        expect(out.updatedAt.getTime()).toBeGreaterThanOrEqual(before);
        expect(out.updatedAt.getTime()).toBeLessThanOrEqual(after);
      }
    });
  });
});
