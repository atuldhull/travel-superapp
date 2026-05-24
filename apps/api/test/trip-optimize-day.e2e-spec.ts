/**
 * Integration tests for `POST /trips/:tripId/days/:dayId/optimize`
 * ([V.UX.6]). Greedy nearest-neighbour reorder over the routing
 * provider's cheapest fastest mode.
 *
 * Installed by prompt [V.UX.6].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { GeoQueries } from '../src/common/db/geo-queries';
import { PrismaService } from '../src/common/db/prisma.service';
import { uniqueEmail, uniqueSuffix } from './factories';

const TEST_PREFIX = 'trip-optimize-e2e';
// North-Pacific remote anchor; collision-free with other Trip suites.
const REMOTE = { lat: 36.7654, lng: -148.5432 };

interface ItemRow {
  readonly id: string;
  readonly position: number;
  readonly placeId: string | null;
  readonly notes: string | null;
}

interface DayRow {
  readonly id: string;
  readonly items: readonly ItemRow[];
}

describe('Trip optimize day route (integration, requires Docker Postgres + Redis)', () => {
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
      console.warn(`trip-optimize test: infra not reachable (${message}). Skipping.`);
      dbReachable = false;
    }
  });

  afterEach(async () => {
    if (dbReachable) {
      await prisma.user.deleteMany({
        where: { displayName: { startsWith: TEST_PREFIX } },
      });
      await prisma.place.deleteMany({
        where: { sourceKey: { startsWith: TEST_PREFIX } },
      });
    }
  });

  afterAll(async () => {
    if (dbReachable) {
      await app.close();
    }
    await moduleRef.close();
  });

  async function registerUser(suffix: string): Promise<{ accessToken: string }> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: uniqueEmail(`${TEST_PREFIX}-${suffix}`),
        password: 'correct-horse-battery-staple',
        displayName: `${TEST_PREFIX}-${suffix}`,
      },
    });
    expect(res.statusCode).toBe(201);
    return JSON.parse(res.body) as { accessToken: string };
  }

  async function seedPlace(slug: string, lat: number, lng: number): Promise<string> {
    const place = await geo.insertPlace({
      sourceKey: `${TEST_PREFIX}-${slug}-${uniqueSuffix()}`,
      name: slug,
      category: 'attraction',
      lat,
      lng,
    });
    return place.id;
  }

  async function createTripWithDay(
    accessToken: string,
    placeIds: readonly string[],
  ): Promise<{ tripId: string; dayId: string }> {
    const trip = await app.inject({
      method: 'POST',
      url: '/api/v1/trips',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        title: 'Optimize trip',
        center: REMOTE,
        radiusKm: 25,
        startsOn: '2026-09-01T00:00:00.000Z',
        endsOn: '2026-09-01T00:00:00.000Z',
      },
    });
    expect(trip.statusCode).toBe(201);
    const tripId = (JSON.parse(trip.body) as { id: string }).id;
    const gen = await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${tripId}/itinerary`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(gen.statusCode).toBe(200);
    const days = (JSON.parse(gen.body) as { days: DayRow[] }).days;
    const dayId = days[0]!.id;
    const items = placeIds.map((pid, i) => ({ position: i + 1, placeId: pid }));
    const patch = await app.inject({
      method: 'PATCH',
      url: `/api/v1/trips/${tripId}/itinerary/${dayId}`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { items },
    });
    expect(patch.statusCode).toBe(200);
    return { tripId, dayId };
  }

  it('reorders the day and reports before/after seconds', async () => {
    if (!dbReachable) return;
    const { accessToken } = await registerUser('happy');
    // Three coords at increasing offsets from the trip anchor. The
    // current order goes anchor → far → mid → close (sub-optimal);
    // greedy NN should converge to anchor → close → mid → far.
    const close = await seedPlace('close', REMOTE.lat + 0.005, REMOTE.lng + 0.005);
    const mid = await seedPlace('mid', REMOTE.lat + 0.02, REMOTE.lng + 0.02);
    const far = await seedPlace('far', REMOTE.lat + 0.05, REMOTE.lng + 0.05);
    const { tripId, dayId } = await createTripWithDay(accessToken, [close, far, mid]);

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${tripId}/days/${dayId}/optimize`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      day: DayRow;
      beforeSeconds: number;
      afterSeconds: number;
      skippedCount: number;
    };
    expect(body.day.items).toHaveLength(3);
    expect(body.skippedCount).toBe(0);
    // Anchor stays at position 1; greedy picks the next-closest.
    expect(body.day.items[0]!.placeId).toBe(close);
    expect(body.day.items[1]!.placeId).toBe(mid);
    expect(body.day.items[2]!.placeId).toBe(far);
    expect(body.afterSeconds).toBeLessThanOrEqual(body.beforeSeconds);
  });

  it('day with one routable item is a no-op', async () => {
    if (!dbReachable) return;
    const { accessToken } = await registerUser('single');
    const lone = await seedPlace('lone', REMOTE.lat + 0.01, REMOTE.lng + 0.01);
    const { tripId, dayId } = await createTripWithDay(accessToken, [lone]);
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${tripId}/days/${dayId}/optimize`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { beforeSeconds: number; afterSeconds: number };
    expect(body.beforeSeconds).toBe(0);
    expect(body.afterSeconds).toBe(0);
  });

  it('non-owner without share → 404 TRIP_NOT_FOUND', async () => {
    if (!dbReachable) return;
    const alice = await registerUser('alice');
    const bob = await registerUser('bob');
    const a = await seedPlace('a', REMOTE.lat + 0.01, REMOTE.lng + 0.01);
    const b = await seedPlace('b', REMOTE.lat + 0.02, REMOTE.lng + 0.02);
    const { tripId, dayId } = await createTripWithDay(alice.accessToken, [a, b]);
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${tripId}/days/${dayId}/optimize`,
      headers: { authorization: `Bearer ${bob.accessToken}` },
    });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).code).toBe('TRIP_NOT_FOUND');
  });

  it('unauthenticated → 401', async () => {
    if (!dbReachable) return;
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/trips/whatever/days/whatever/optimize',
    });
    expect(res.statusCode).toBe(401);
  });
});
