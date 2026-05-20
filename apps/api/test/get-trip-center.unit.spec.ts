/**
 * Pure unit tests for GetTripCenterUseCase (Phase 2 polish F2).
 *
 * The e2e suite (`plan-with-ai.e2e-spec.ts`) already exercises the
 * route end-to-end through Postgres; this complements with mocked
 * deps so the use-case's branch logic is provable without the DB.
 *
 * Installed for Phase 2 polish (F26).
 */
import { GeoQueries } from '../src/common/db/geo-queries';
import { GetTripCenterUseCase } from '../src/modules/trip/application/get-trip-center.use-case';
import type { TripRepository } from '../src/modules/trip/application/ports/trip.repository';
import type { TripEntity } from '../src/modules/trip/domain/trip.entity';

class StubTripRepository implements Partial<TripRepository> {
  public byKey = new Map<string, TripEntity>();

  async findByIdForUser(id: string, userId: string): Promise<TripEntity | null> {
    return this.byKey.get(`${id}:${userId}`) ?? null;
  }
}

class StubGeoQueries {
  public centers = new Map<string, { lat: number; lng: number }>();

  async findTripCenter(tripId: string): Promise<{ lat: number; lng: number } | null> {
    return this.centers.get(tripId) ?? null;
  }
}

function buildTrip(id: string, userId: string): TripEntity {
  // Minimal shape that satisfies the use-case's reads.
  return {
    id,
    userId,
    title: 'unit-test trip',
    status: 'draft',
    radiusKm: 5,
    startsOn: null,
    endsOn: null,
    version: 1,
    archivedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as TripEntity;
}

describe('GetTripCenterUseCase (unit)', () => {
  let trips: StubTripRepository;
  let geo: StubGeoQueries;
  let uc: GetTripCenterUseCase;

  beforeEach(() => {
    trips = new StubTripRepository();
    geo = new StubGeoQueries();
    uc = new GetTripCenterUseCase(trips as unknown as TripRepository, geo as unknown as GeoQueries);
  });

  it('returns { lat, lng } for an owner-readable trip with a center', async () => {
    const tripId = 't-1';
    const userId = 'u-1';
    trips.byKey.set(`${tripId}:${userId}`, buildTrip(tripId, userId));
    geo.centers.set(tripId, { lat: 12.34, lng: -45.67 });

    const result = await uc.execute(tripId, userId);
    expect(result).toEqual({ lat: 12.34, lng: -45.67 });
  });

  it('throws TRIP_NOT_FOUND when the repository finds nothing (wrong owner or missing id)', async () => {
    await expect(uc.execute('does-not-exist', 'u-1')).rejects.toMatchObject({
      code: 'TRIP_NOT_FOUND',
    });
  });

  it('throws TRIP_NOT_FOUND when the trip exists but the PostGIS center is missing (invariant violation)', async () => {
    const tripId = 't-2';
    const userId = 'u-1';
    trips.byKey.set(`${tripId}:${userId}`, buildTrip(tripId, userId));
    // No geo.centers entry — simulates direct-SQL tampering.

    await expect(uc.execute(tripId, userId)).rejects.toMatchObject({
      code: 'TRIP_NOT_FOUND',
    });
  });

  it('IDOR: another user asking for the same trip id gets TRIP_NOT_FOUND', async () => {
    const tripId = 't-3';
    trips.byKey.set(`${tripId}:alice`, buildTrip(tripId, 'alice'));
    geo.centers.set(tripId, { lat: 1, lng: 2 });

    await expect(uc.execute(tripId, 'bob')).rejects.toMatchObject({ code: 'TRIP_NOT_FOUND' });
  });
});
