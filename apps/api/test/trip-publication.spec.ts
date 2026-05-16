/**
 * POST.2B.2 — unit tests for the privacy invariants + publish flow.
 *
 * Pure/fake (no Postgres, no HTTP):
 *   INVARIANT A — only an ENDED trip is publishable.
 *   INVARIANT B — PUBLIC/FOLLOWERS-no-optin coarsen exposed geo;
 *                 FOLLOWERS+optin keeps precise; PRIVATE → none.
 *   Use-case  — owner-gate, default visibility FOLLOWERS (D2),
 *               unpublish → setPrivate.
 *
 * Installed by prompt [POST.2B.2].
 */
import { NotFoundError, ValidationError } from '@app/errors';
import {
  assertPublishable,
  coarsenCoord,
  exposeGeo,
  type TripPublication,
} from '../src/modules/feed/domain/trip-publication.entity';
import { PublishTripUseCase } from '../src/modules/feed/application/publish-trip.use-case';
import { UnpublishTripUseCase } from '../src/modules/feed/application/unpublish-trip.use-case';
import type { TripPublicationRepository } from '../src/modules/feed/application/ports/trip-publication.repository';
import type { TripRepository } from '../src/modules/trip/application/ports/trip.repository';
import type { GeoQueries } from '../src/common/db/geo-queries';

const NOW = new Date('2026-05-16T00:00:00.000Z');
const YESTERDAY = new Date('2026-05-15T00:00:00.000Z');
const TOMORROW = new Date('2026-05-17T00:00:00.000Z');

describe('TripPublication invariants (POST.2B.2, pure domain)', () => {
  it('INVARIANT A: null or future end date → 422 TRIP_NOT_ENDED', () => {
    expect(() => assertPublishable(null, NOW)).toThrow(ValidationError);
    expect(() => assertPublishable(TOMORROW, NOW)).toThrow(ValidationError);
    try {
      assertPublishable(null, NOW);
    } catch (e) {
      expect((e as { code: string }).code).toBe('TRIP_NOT_ENDED');
    }
  });

  it('INVARIANT A: a trip that ended is publishable (no throw)', () => {
    expect(() => assertPublishable(YESTERDAY, NOW)).not.toThrow();
  });

  it('INVARIANT B: PUBLIC coarsens to ~city level (≤ 1 dp)', () => {
    const g = exposeGeo(48.8566, -2.3522, 'PUBLIC', false);
    expect(g).toEqual({ lat: coarsenCoord(48.8566), lng: coarsenCoord(-2.3522) });
    expect(g.lat).not.toBe(48.8566); // not the exact spot
  });

  it('INVARIANT B: FOLLOWERS coarsens WITHOUT opt-in, precise WITH it', () => {
    expect(exposeGeo(10.12345, 20.6789, 'FOLLOWERS', false)).toEqual({
      lat: coarsenCoord(10.12345),
      lng: coarsenCoord(20.6789),
    });
    expect(exposeGeo(10.12345, 20.6789, 'FOLLOWERS', true)).toEqual({
      lat: 10.12345,
      lng: 20.6789,
    });
  });

  it('INVARIANT B: PRIVATE (or missing coords) exposes nothing', () => {
    expect(exposeGeo(1, 2, 'PRIVATE', true)).toEqual({ lat: null, lng: null });
    expect(exposeGeo(null, null, 'PUBLIC', false)).toEqual({ lat: null, lng: null });
  });
});

describe('PublishTripUseCase / UnpublishTripUseCase (POST.2B.2, fakes)', () => {
  const geo = {
    findTripCenter: async () => ({ lat: 48.8566, lng: 2.3522 }),
  } as unknown as GeoQueries;

  function tripsWith(endsOn: Date | null): TripRepository {
    return {
      findByIdForUser: async (id: string, userId: string) =>
        userId === 'owner' ? { id, userId, endsOn } : null,
    } as unknown as TripRepository;
  }

  class FakePubs implements TripPublicationRepository {
    last: TripPublication | null = null;
    setPrivateCalls: Array<[string, string]> = [];
    async upsertPublish(i: {
      tripId: string;
      authorId: string;
      memoryBookId: string | null;
      visibility: TripPublication['visibility'];
      exposedLat: number | null;
      exposedLng: number | null;
      publishedAt: Date;
    }): Promise<TripPublication> {
      this.last = {
        id: 'pub1',
        ...i,
        createdAt: NOW,
        updatedAt: NOW,
      };
      return this.last;
    }
    async setPrivate(tripId: string, authorId: string): Promise<void> {
      this.setPrivateCalls.push([tripId, authorId]);
    }
    async findByTrip(): Promise<TripPublication | null> {
      return this.last;
    }
    // POST.2B.3 — feed-query methods not exercised by this spec.
    async listFeed(): Promise<readonly TripPublication[]> {
      return [];
    }
    async listByAuthorVisibleTo(): Promise<readonly TripPublication[]> {
      return [];
    }
    async countPublishedByAuthor(): Promise<number> {
      return 0;
    }
    async countFollowers(): Promise<number> {
      return 0;
    }
  }

  it('rejects a non-owner with TRIP_NOT_FOUND', async () => {
    const uc = new PublishTripUseCase(tripsWith(YESTERDAY), geo, new FakePubs());
    await expect(uc.execute({ tripId: 't1', userId: 'someone-else' })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it('rejects publishing a not-yet-ended trip (INVARIANT A, no HTTP)', async () => {
    const uc = new PublishTripUseCase(tripsWith(TOMORROW), geo, new FakePubs());
    await expect(uc.execute({ tripId: 't1', userId: 'owner' })).rejects.toMatchObject({
      code: 'TRIP_NOT_ENDED',
    });
  });

  it('defaults to FOLLOWERS (D2) and coarsens its geo without opt-in', async () => {
    const pubs = new FakePubs();
    const uc = new PublishTripUseCase(tripsWith(YESTERDAY), geo, pubs);
    const out = await uc.execute({ tripId: 't1', userId: 'owner' });
    expect(out.visibility).toBe('FOLLOWERS');
    expect(out.exposedLat).toBe(coarsenCoord(48.8566));
  });

  it('PUBLIC coarsens; unpublish calls setPrivate (owner-scoped)', async () => {
    const pubs = new FakePubs();
    const pub = new PublishTripUseCase(tripsWith(YESTERDAY), geo, pubs);
    const out = await pub.execute({ tripId: 't1', userId: 'owner', visibility: 'PUBLIC' });
    expect(out.exposedLat).toBe(coarsenCoord(48.8566));
    expect(out.exposedLat).not.toBe(48.8566);

    const unpub = new UnpublishTripUseCase(pubs);
    await unpub.execute({ tripId: 't1', userId: 'owner' });
    await unpub.execute({ tripId: 't1', userId: 'owner' }); // idempotent
    expect(pubs.setPrivateCalls).toEqual([
      ['t1', 'owner'],
      ['t1', 'owner'],
    ]);
  });
});
