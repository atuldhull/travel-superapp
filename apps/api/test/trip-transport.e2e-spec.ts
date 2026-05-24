/**
 * Integration tests for the Trip × Transport fold-in
 * ([IV.18.10.2]).
 *
 *   GET /api/v1/trips/:id/transport-legs — owner-gated; returns
 *     a flat array of `{ dayId, dayIndex, fromItemId, toItemId,
 *     fromPlaceId, toPlaceId, routes }` objects, one per
 *     consecutive pair of items pinned to a Place.
 *
 * Also asserts the overview now includes a `transport` section
 * (6th sibling alongside itinerary/weather/stays/eateries/events).
 *
 * Drives the real `MockRoutingProvider` — its haversine-based
 * deterministic shape makes assertions exact. Routing cache
 * `routing:*` is wiped in `beforeAll` so prior runs don't shadow
 * upstream invocations.
 *
 * Installed by prompt [IV.18.10.2].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import Redis from 'ioredis';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { GeoQueries } from '../src/common/db/geo-queries';
import { PrismaService } from '../src/common/db/prisma.service';
import type { RouteLeg } from '../src/modules/transport/domain/route-leg.entity';
import { uniqueEmail, uniqueSuffix } from './factories';

const SOURCE_PREFIX = 'trip-transport-e2e';
// Suite-local trip center (mid-Atlantic, no collision with other Trip suites).
const CENTER = { lat: 8.7654, lng: -33.4321 };

interface TransportLegResp {
  readonly dayId: string;
  readonly dayIndex: number;
  readonly fromItemId: string;
  readonly toItemId: string;
  readonly fromPlaceId: string;
  readonly toPlaceId: string;
  readonly routes: readonly RouteLeg[];
}

describe('Trip × Transport (integration, requires Postgres + Redis)', () => {
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

      // Drop stale routing cache entries.
      const flush = new Redis(process.env['REDIS_URL']!, {
        lazyConnect: false,
        maxRetriesPerRequest: 2,
      });
      try {
        const stream = flush.scanStream({
          match: `travel-${process.env['NODE_ENV']}:routing:*`,
          count: 100,
        });
        for await (const keys of stream as unknown as AsyncIterable<string[]>) {
          if (keys.length > 0) await flush.del(...keys);
        }
      } finally {
        await flush.quit();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // eslint-disable-next-line no-console
      console.warn(`trip-transport test: infra not reachable (${message}). Skipping.`);
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
    });
    expect(res.statusCode).toBe(201);
    return (JSON.parse(res.body) as { accessToken: string }).accessToken;
  }

  async function seedPlace(suffix: string, latOffset: number, lngOffset: number): Promise<string> {
    const row = await geo.insertPlace({
      sourceKey: `${SOURCE_PREFIX}-${suffix}-${uniqueSuffix()}`,
      name: `seed-${suffix}`,
      category: 'park',
      lat: CENTER.lat + latOffset,
      lng: CENTER.lng + lngOffset,
    });
    return row.id;
  }

  async function makeTripWithDay(token: string): Promise<{ tripId: string; dayId: string }> {
    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/trips',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        title: `${SOURCE_PREFIX}-trip`,
        center: CENTER,
        radiusKm: 5,
        startsOn: '2026-09-01',
        endsOn: '2026-09-01',
      },
    });
    expect(create.statusCode).toBe(201);
    const tripId = (JSON.parse(create.body) as { id: string }).id;

    const gen = await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${tripId}/itinerary`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(gen.statusCode).toBe(200);
    const dayId = (JSON.parse(gen.body) as { days: [{ id: string }] }).days[0]!.id;
    return { tripId, dayId };
  }

  async function setItems(
    token: string,
    tripId: string,
    dayId: string,
    items: Array<{ position: number; placeId: string | null }>,
  ): Promise<void> {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/trips/${tripId}/itinerary/${dayId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { items },
    });
    expect(res.statusCode).toBe(200);
  }

  it('GET /trips/:id/transport-legs without a bearer → 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/trips/some-trip/transport-legs',
    });
    expect(res.statusCode).toBe(401);
  });

  it('non-owner / unknown trip → 404 TRIP_NOT_FOUND', async () => {
    const tok = await registerAndGetToken('idor');
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/trips/does-not-exist/transport-legs',
      headers: { authorization: `Bearer ${tok}` },
    });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).code).toBe('TRIP_NOT_FOUND');
  });

  it('day with no items → empty legs array', async () => {
    const tok = await registerAndGetToken('empty');
    const { tripId } = await makeTripWithDay(tok);
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/trips/${tripId}/transport-legs`,
      headers: { authorization: `Bearer ${tok}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { legs: TransportLegResp[] };
    expect(body.legs).toEqual([]);
  });

  it('happy path: 3 items pinned to Places → 2 consecutive legs with all 7 modes', async () => {
    const tok = await registerAndGetToken('happy');
    const { tripId, dayId } = await makeTripWithDay(tok);
    const p1 = await seedPlace('a', 0, 0);
    const p2 = await seedPlace('b', 0.005, 0.005);
    const p3 = await seedPlace('c', 0.01, 0.01);
    await setItems(tok, tripId, dayId, [
      { position: 1, placeId: p1 },
      { position: 2, placeId: p2 },
      { position: 3, placeId: p3 },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/trips/${tripId}/transport-legs`,
      headers: { authorization: `Bearer ${tok}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { legs: TransportLegResp[] };
    expect(body.legs).toHaveLength(2);
    expect(body.legs[0]!.fromPlaceId).toBe(p1);
    expect(body.legs[0]!.toPlaceId).toBe(p2);
    expect(body.legs[1]!.fromPlaceId).toBe(p2);
    expect(body.legs[1]!.toPlaceId).toBe(p3);
    // Mock provider returns all 7 modes when distance ≤ 20km.
    const modes = body.legs[0]!.routes.map((r) => r.mode).sort();
    expect(modes).toEqual(
      ['bicycle', 'car', 'public_transit', 'rideshare', 'taxi', 'two_wheeler', 'walk'].sort(),
    );
  });

  it('a free-form item (placeId=null) is skipped — leg jumps over it', async () => {
    const tok = await registerAndGetToken('skip');
    const { tripId, dayId } = await makeTripWithDay(tok);
    const p1 = await seedPlace('s1', 0, 0);
    const p2 = await seedPlace('s2', 0.004, 0.004);
    await setItems(tok, tripId, dayId, [
      { position: 1, placeId: p1 },
      { position: 2, placeId: null },
      { position: 3, placeId: p2 },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/trips/${tripId}/transport-legs`,
      headers: { authorization: `Bearer ${tok}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { legs: TransportLegResp[] };
    // Only the (p1, null) and (null, p2) pairs exist; both have a
    // null side, so neither is a leg. Result: empty.
    expect(body.legs).toEqual([]);
  });

  it('two consecutive items at the same place are silently skipped', async () => {
    const tok = await registerAndGetToken('same');
    const { tripId, dayId } = await makeTripWithDay(tok);
    const same = await seedPlace('same', 0, 0);
    const p2 = await seedPlace('p2', 0.005, 0.005);
    await setItems(tok, tripId, dayId, [
      { position: 1, placeId: same },
      { position: 2, placeId: same },
      { position: 3, placeId: p2 },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/trips/${tripId}/transport-legs`,
      headers: { authorization: `Bearer ${tok}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { legs: TransportLegResp[] };
    // Pair (same, same) is dropped; pair (same, p2) yields 1 leg.
    expect(body.legs).toHaveLength(1);
    expect(body.legs[0]!.fromPlaceId).toBe(same);
    expect(body.legs[0]!.toPlaceId).toBe(p2);
  });

  it('GET /trips/:id/overview now includes a transport section with the legs', async () => {
    const tok = await registerAndGetToken('overview');
    const { tripId, dayId } = await makeTripWithDay(tok);
    const p1 = await seedPlace('o1', 0, 0);
    const p2 = await seedPlace('o2', 0.005, 0.005);
    await setItems(tok, tripId, dayId, [
      { position: 1, placeId: p1 },
      { position: 2, placeId: p2 },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/trips/${tripId}/overview`,
      headers: { authorization: `Bearer ${tok}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      transport: { ok: true; data: { legs: TransportLegResp[] } } | { ok: false; code: string };
    };
    expect(body.transport.ok).toBe(true);
    if (body.transport.ok) {
      expect(body.transport.data.legs).toHaveLength(1);
      expect(body.transport.data.legs[0]!.fromPlaceId).toBe(p1);
    }
  });
});
