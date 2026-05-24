/**
 * Integration tests for `GET /trips/:id/eateries` ([IV.18.7.2]).
 *
 * Same cross-module wiring shape as trip-weather + trip-stays: Trip
 * use-case reads trip.center via GeoQueries, delegates to the Food
 * module's SearchEateriesUseCase. Provider is stubbed at the
 * `MockEateryProvider` class token so the cache + decorator stay in
 * the chain but upstream invocations are countable.
 *
 * Installed by prompt [IV.18.7.2].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import Redis from 'ioredis';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';
import type {
  EateryProvider,
  SearchEateriesInput,
} from '../src/modules/food/application/ports/eatery-provider';
import type { EateryListing } from '../src/modules/food/domain/eatery-listing.entity';
import { MockEateryProvider } from '../src/modules/food/infrastructure/mock-eatery-provider';
import { uniqueEmail } from './factories';

const TEST_PREFIX = 'trip-eateries-e2e';
// Mid-Indian-Ocean coord — no collision with other Trip suites.
const REMOTE = { lat: -15.8765, lng: 78.4321 };

class RecordingEateryProvider implements EateryProvider {
  public calls: SearchEateriesInput[] = [];

  reset(): void {
    this.calls = [];
  }

  async searchNearby(input: SearchEateriesInput): Promise<readonly EateryListing[]> {
    this.calls.push(input);
    return [
      {
        externalId: `mock:trip-eats-${input.lat}-${input.lng}`,
        provider: 'mock',
        name: 'Trip Eatery Stub',
        cuisineTags: input.cuisineTag ? [input.cuisineTag] : ['mock'],
        priceTier: input.maxPriceTier ?? 3,
        lat: input.lat,
        lng: input.lng,
        distanceMeters: 400,
      },
    ];
  }
}

describe('Trip × Eateries (integration, requires Docker Postgres + Redis)', () => {
  let moduleRef: TestingModule;
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let stub: RecordingEateryProvider;
  let dbReachable = true;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MockEateryProvider)
      .useValue(new RecordingEateryProvider())
      .compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.useGlobalFilters(new AllExceptionFilter(), new DomainExceptionFilter());
    app.setGlobalPrefix('api/v1', { exclude: ['health', 'health/(.*)'] });
    await app.register(fastifyCookie);
    try {
      await app.init();
      await app.getHttpAdapter().getInstance().ready();
      prisma = moduleRef.get(PrismaService);
      stub = moduleRef.get<RecordingEateryProvider>(MockEateryProvider);
      await prisma.$queryRaw`SELECT 1`;

      // Wipe stale cache entries so prior-run entries don't mask
      // upstream calls this suite expects to observe.
      const flush = new Redis(process.env['REDIS_URL']!, {
        lazyConnect: false,
        maxRetriesPerRequest: 2,
      });
      try {
        const stream = flush.scanStream({
          match: `travel-${process.env['NODE_ENV']}:eateries:*`,
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
      console.warn(`trip-eateries test: infra not reachable (${message}). Skipping.`);
      dbReachable = false;
    }
  });

  afterEach(async () => {
    if (dbReachable) {
      stub.reset();
      await prisma.user.deleteMany({
        where: { displayName: { startsWith: TEST_PREFIX } },
      });
    }
  });

  afterAll(async () => {
    if (dbReachable) {
      await app.close();
    }
    await moduleRef.close();
  });

  async function registerUser(suffix: string): Promise<{
    userId: string;
    accessToken: string;
  }> {
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
    return JSON.parse(res.body) as { userId: string; accessToken: string };
  }

  async function createTrip(
    accessToken: string,
    extra?: { radiusKm?: number; startsOn?: string; endsOn?: string },
  ): Promise<{ id: string }> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/trips',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        title: 'Eatery test trip',
        center: REMOTE,
        radiusKm: extra?.radiusKm ?? 3,
        ...(extra?.startsOn ? { startsOn: extra.startsOn } : {}),
        ...(extra?.endsOn ? { endsOn: extra.endsOn } : {}),
      },
    });
    expect(res.statusCode).toBe(201);
    return { id: (JSON.parse(res.body) as { id: string }).id };
  }

  it('GET /trips/:id/eateries passes trip.center + trip.radiusKm to the provider', async () => {
    const { accessToken } = await registerUser('ok');
    const trip = await createTrip(accessToken);

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/trips/${trip.id}/eateries`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { eateries: EateryListing[] };
    expect(body.eateries).toHaveLength(1);

    expect(stub.calls).toHaveLength(1);
    const call = stub.calls[0]!;
    expect(call.lat).toBeCloseTo(REMOTE.lat, 4);
    expect(call.lng).toBeCloseTo(REMOTE.lng, 4);
    expect(call.radiusKm).toBe(3);
    expect(call.cuisineTag).toBeUndefined();
    expect(call.maxPriceTier).toBeUndefined();
  });

  it('query filters (?cuisineTag + ?maxPriceTier) flow through to the provider', async () => {
    const { accessToken } = await registerUser('filters');
    const trip = await createTrip(accessToken);

    await app.inject({
      method: 'GET',
      url: `/api/v1/trips/${trip.id}/eateries?cuisineTag=japanese&maxPriceTier=3`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(stub.calls[0]!.cuisineTag).toBe('japanese');
    expect(stub.calls[0]!.maxPriceTier).toBe(3);
  });

  it('trip.radiusKm > 25 is clamped to 25 at the provider call', async () => {
    const { accessToken } = await registerUser('clamp');
    const trip = await createTrip(accessToken, { radiusKm: 250 });

    await app.inject({
      method: 'GET',
      url: `/api/v1/trips/${trip.id}/eateries`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(stub.calls[0]!.radiusKm).toBe(25);
  });

  it('trip without dates still works (dates are NOT required for eatery search)', async () => {
    const { accessToken } = await registerUser('no-dates');
    const trip = await createTrip(accessToken); // no dates

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/trips/${trip.id}/eateries`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    // Intentionally assert ONLY the status code — the cache may
    // have served this from an earlier test in the same suite that
    // used the same (lat, lng, radiusKm, filters) tuple. The point
    // here is "no TRIP_DATES_REQUIRED error", not "provider called".
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { eateries: EateryListing[] };
    expect(body.eateries.length).toBeGreaterThanOrEqual(1);
  });

  it('non-owner → 404 TRIP_NOT_FOUND (provider never invoked)', async () => {
    const alice = await registerUser('alice');
    const bob = await registerUser('bob');
    const trip = await createTrip(alice.accessToken);

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/trips/${trip.id}/eateries`,
      headers: { authorization: `Bearer ${bob.accessToken}` },
    });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).code).toBe('TRIP_NOT_FOUND');
    expect(stub.calls).toHaveLength(0);
  });

  it('unauthenticated → 401 UNAUTHENTICATED', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/trips/whatever/eateries',
    });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).code).toBe('UNAUTHENTICATED');
    expect(stub.calls).toHaveLength(0);
  });
});
