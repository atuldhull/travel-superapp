/**
 * Integration tests for [IV.18.2.10] — GenerateItineraryStubUseCase
 * now picks Places from the Places module and distributes them
 * round-robin across days as `ItineraryItem` rows.
 *
 * Seeds N places near a trip's center, drives POST /trips/:id/itinerary,
 * asserts the day-with-items shape and the round-robin distribution.
 *
 * Complements (does not replace) `itinerary.e2e-spec.ts`, which still
 * exercises the no-places path (empty itinerary still works).
 *
 * Installed by prompt [IV.18.2.10].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { GeoQueries } from '../src/common/db/geo-queries';
import { PrismaService } from '../src/common/db/prisma.service';
import { uniqueEmail } from './factories';

const SOURCE_PREFIX = 'itin-items-e2e';
// Suite-local trip center: somewhere remote, distinct from other
// suites (geo-queries / index-usage / places-e2e / itinerary at
// their own coords). Prevents cross-suite Place contamination in
// the generator's radius search.
const VICTORIA = { lat: 34.5678, lng: 125.4321 };

interface DayResp {
  readonly id: string;
  readonly dayIndex: number;
  readonly items: Array<{
    readonly id: string;
    readonly position: number;
    readonly placeId: string | null;
  }>;
}

describe('Itinerary items (integration, requires Docker Postgres)', () => {
  let moduleRef: TestingModule;
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let geo: GeoQueries;
  let dbReachable = true;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.useGlobalFilters(new AllExceptionFilter(), new DomainExceptionFilter());
    app.setGlobalPrefix('api/v1', { exclude: ['health', 'health/(.*)'] });
    await app.register(fastifyCookie);
    try {
      await app.init();
      await app.getHttpAdapter().getInstance().ready();
      prisma = moduleRef.get(PrismaService);
      geo = moduleRef.get(GeoQueries);
      await prisma.$queryRaw`SELECT 1`;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // eslint-disable-next-line no-console
      console.warn(`itin-items test: DB not reachable (${message}). Skipping.`);
      dbReachable = false;
    }
  });

  afterEach(async () => {
    await prisma.place.deleteMany({
      where: { sourceKey: { startsWith: SOURCE_PREFIX } },
    });
    await prisma.user.deleteMany({
      where: { displayName: { startsWith: SOURCE_PREFIX } },
    });
  });

  afterAll(async () => {
    if (dbReachable) {
      await app.close();
    }
    await moduleRef.close();
  });

  async function registerAndGetToken(suffix: string): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: uniqueEmail(`${SOURCE_PREFIX}-${suffix}`),
        password: 'correct-horse-battery-staple',
        displayName: `${SOURCE_PREFIX}-${suffix}`,
      },
      headers: { 'user-agent': 'itin-items-ua' },
    });
    expect(res.statusCode).toBe(201);
    return (JSON.parse(res.body) as { accessToken: string }).accessToken;
  }

  async function createTrip(
    accessToken: string,
    opts: { startsOn: string; endsOn: string },
  ): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/trips',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        title: `${SOURCE_PREFIX}-trip`,
        center: VICTORIA,
        radiusKm: 5,
        startsOn: opts.startsOn,
        endsOn: opts.endsOn,
      },
    });
    expect(res.statusCode).toBe(201);
    return (JSON.parse(res.body) as { id: string }).id;
  }

  async function seedPlacesNearby(count: number): Promise<string[]> {
    const ids: string[] = [];
    for (let i = 0; i < count; i++) {
      // Scatter along a small lat offset — all well inside 5km.
      const row = await geo.insertPlace({
        sourceKey: `${SOURCE_PREFIX}-p${i}`,
        name: `seed-${i}`,
        category: 'park',
        lat: VICTORIA.lat + i * 0.0005,
        lng: VICTORIA.lng,
      });
      ids.push(row.id);
    }
    return ids;
  }

  it('3-day trip with 9 seeded places → 3 items per day, round-robin distribution', async () => {
    const token = await registerAndGetToken('full');
    const seededIds = await seedPlacesNearby(9);
    const tripId = await createTrip(token, {
      startsOn: '2026-08-01',
      endsOn: '2026-08-03',
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${tripId}/itinerary`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const days = (JSON.parse(res.body) as { days: DayResp[] }).days;
    expect(days).toHaveLength(3);

    // Every day has exactly 3 items; positions are 1..3.
    for (const d of days) {
      expect(d.items).toHaveLength(3);
      expect(d.items.map((i) => i.position)).toEqual([1, 2, 3]);
      for (const it of d.items) {
        expect(seededIds).toContain(it.placeId);
      }
    }

    // Every seeded place is referenced exactly once across the trip
    // (round-robin + enough capacity = perfect cover, no re-use).
    const allItemPlaceIds = days.flatMap((d) => d.items.map((i) => i.placeId!));
    const unique = new Set(allItemPlaceIds);
    expect(unique.size).toBe(9);

    // Persistence check: the DB has 9 ItineraryItem rows for this trip.
    const rowCount = await prisma.itineraryItem.count({
      where: { day: { tripId } },
    });
    expect(rowCount).toBe(9);
  });

  it('2-day trip with only 3 seeded places → day 1 gets 2 items, day 2 gets 1 (round-robin)', async () => {
    const token = await registerAndGetToken('scarce');
    await seedPlacesNearby(3);
    const tripId = await createTrip(token, {
      startsOn: '2026-08-01',
      endsOn: '2026-08-02',
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${tripId}/itinerary`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const days = (JSON.parse(res.body) as { days: DayResp[] }).days;
    expect(days).toHaveLength(2);
    // Round-robin: place[0] → day1, place[1] → day2, place[2] → day1.
    expect(days[0]!.items).toHaveLength(2);
    expect(days[1]!.items).toHaveLength(1);
  });

  it('no places nearby → days are created with empty items (back-compat with pre-Places generator)', async () => {
    const token = await registerAndGetToken('barren');
    // Seed places far from the trip center — outside 5km.
    await geo.insertPlace({
      sourceKey: `${SOURCE_PREFIX}-far`,
      name: 'far-away',
      category: 'park',
      lat: 45, // ~740 km from Victoria.
      lng: 0,
    });
    const tripId = await createTrip(token, {
      startsOn: '2026-08-01',
      endsOn: '2026-08-02',
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${tripId}/itinerary`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const days = (JSON.parse(res.body) as { days: DayResp[] }).days;
    expect(days).toHaveLength(2);
    for (const d of days) {
      expect(d.items).toEqual([]);
    }
  });

  it('GET /trips/:id/itinerary returns days with items nested', async () => {
    const token = await registerAndGetToken('read');
    await seedPlacesNearby(2);
    const tripId = await createTrip(token, {
      startsOn: '2026-08-01',
      endsOn: '2026-08-01',
    });
    await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${tripId}/itinerary`,
      headers: { authorization: `Bearer ${token}` },
    });
    const read = await app.inject({
      method: 'GET',
      url: `/api/v1/trips/${tripId}/itinerary`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(read.statusCode).toBe(200);
    const days = (JSON.parse(read.body) as { days: DayResp[] }).days;
    expect(days).toHaveLength(1);
    expect(days[0]!.items).toHaveLength(2);
  });

  it('re-generating the itinerary wipes old items (no duplicate rows)', async () => {
    const token = await registerAndGetToken('replan');
    await seedPlacesNearby(6);
    const tripId = await createTrip(token, {
      startsOn: '2026-08-01',
      endsOn: '2026-08-02',
    });

    for (let i = 0; i < 3; i++) {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/trips/${tripId}/itinerary`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
    }
    const items = await prisma.itineraryItem.count({
      where: { day: { tripId } },
    });
    // 2-day trip × 3 items per day = 6 items, not 18.
    expect(items).toBe(6);
  });
});
