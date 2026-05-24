/**
 * Integration tests for `GET /trips/:id/stays` ([IV.18.6.2]).
 *
 * Same cross-module wiring shape as the trip-weather suite: owner
 * gate → read PostGIS center → delegate to the Stays module's own
 * use-case. Provider is stubbed at the `MockStayProvider` class
 * token so the decorator + cache stay in the chain but the data
 * source is a recorder.
 *
 * Installed by prompt [IV.18.6.2].
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
  SearchStaysInput,
  StayProvider,
} from '../src/modules/stays/application/ports/stay-provider';
import type { StayListing } from '../src/modules/stays/domain/stay-listing.entity';
import { MockStayProvider } from '../src/modules/stays/infrastructure/mock-stay-provider';
import { uniqueEmail } from './factories';

const TEST_PREFIX = 'trip-stays-e2e';
// Mid-Arctic coord — unique vs every other Trip-related suite.
const REMOTE = { lat: 72.3456, lng: 37.8901 };

class RecordingStayProvider implements StayProvider {
  public calls: SearchStaysInput[] = [];

  reset(): void {
    this.calls = [];
  }

  async searchNearby(input: SearchStaysInput): Promise<readonly StayListing[]> {
    this.calls.push(input);
    return [
      {
        externalId: `mock:trip-stays-${input.lat}-${input.lng}`,
        provider: 'mock',
        name: 'Trip Stays Stub',
        starRating: 4,
        amenities: ['wifi'],
        lat: input.lat,
        lng: input.lng,
        distanceMeters: 300,
        priceUsdPerNight: 129,
        currency: 'USD',
        stayType: 'inn',
        wifiSpeedMbps: 50,
      },
    ];
  }
}

describe('Trip × Stays (integration, requires Docker Postgres + Redis)', () => {
  let moduleRef: TestingModule;
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let stub: RecordingStayProvider;
  let dbReachable = true;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MockStayProvider)
      .useValue(new RecordingStayProvider())
      .compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.useGlobalFilters(new AllExceptionFilter(), new DomainExceptionFilter());
    app.setGlobalPrefix('api/v1', { exclude: ['health', 'health/(.*)'] });
    await app.register(fastifyCookie);
    try {
      await app.init();
      await app.getHttpAdapter().getInstance().ready();
      prisma = moduleRef.get(PrismaService);
      stub = moduleRef.get<RecordingStayProvider>(MockStayProvider);
      await prisma.$queryRaw`SELECT 1`;

      // Wipe stays cache so prior-run entries don't hide upstream
      // calls this suite expects to see.
      const flush = new Redis(process.env['REDIS_URL']!, {
        lazyConnect: false,
        maxRetriesPerRequest: 2,
      });
      try {
        const stream = flush.scanStream({
          match: `travel-${process.env['NODE_ENV']}:stays:*`,
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
      console.warn(`trip-stays test: infra not reachable (${message}). Skipping.`);
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
    const body = JSON.parse(res.body) as { userId: string; accessToken: string };
    return body;
  }

  async function createTrip(
    accessToken: string,
    extra?: { startsOn?: string; endsOn?: string; radiusKm?: number },
  ): Promise<{ id: string }> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/trips',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        title: 'Stays test trip',
        center: REMOTE,
        radiusKm: extra?.radiusKm ?? 5,
        ...(extra?.startsOn ? { startsOn: extra.startsOn } : {}),
        ...(extra?.endsOn ? { endsOn: extra.endsOn } : {}),
      },
    });
    expect(res.statusCode).toBe(201);
    return { id: (JSON.parse(res.body) as { id: string }).id };
  }

  it('GET /trips/:id/stays passes trip.center + trip dates to the provider', async () => {
    if (!dbReachable) return;
    const { accessToken } = await registerUser('ok');
    const trip = await createTrip(accessToken, {
      startsOn: '2026-11-01',
      endsOn: '2026-11-05',
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/trips/${trip.id}/stays`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { stays: StayListing[] };
    expect(body.stays).toHaveLength(1);

    expect(stub.calls).toHaveLength(1);
    const call = stub.calls[0]!;
    expect(call.lat).toBeCloseTo(REMOTE.lat, 4);
    expect(call.lng).toBeCloseTo(REMOTE.lng, 4);
    expect(call.checkIn).toBe('2026-11-01');
    expect(call.checkOut).toBe('2026-11-05');
    expect(call.radiusKm).toBe(5);
    expect(call.guests).toBe(1);
  });

  it('?guests=3 flows through to the provider', async () => {
    if (!dbReachable) return;
    const { accessToken } = await registerUser('guests');
    const trip = await createTrip(accessToken, {
      startsOn: '2026-11-10',
      endsOn: '2026-11-12',
    });

    await app.inject({
      method: 'GET',
      url: `/api/v1/trips/${trip.id}/stays?guests=3`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(stub.calls[0]!.guests).toBe(3);
  });

  it('trip.radiusKm > 50 is clamped to 50 at the provider call', async () => {
    if (!dbReachable) return;
    const { accessToken } = await registerUser('clamp');
    const trip = await createTrip(accessToken, {
      startsOn: '2026-11-20',
      endsOn: '2026-11-22',
      radiusKm: 300,
    });

    await app.inject({
      method: 'GET',
      url: `/api/v1/trips/${trip.id}/stays`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(stub.calls[0]!.radiusKm).toBe(50);
  });

  it('trip without startsOn/endsOn → 422 TRIP_DATES_REQUIRED (provider not called)', async () => {
    if (!dbReachable) return;
    const { accessToken } = await registerUser('no-dates');
    const trip = await createTrip(accessToken); // no dates

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/trips/${trip.id}/stays`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body).code).toBe('TRIP_DATES_REQUIRED');
    expect(stub.calls).toHaveLength(0);
  });

  it('non-owner → 404 TRIP_NOT_FOUND (provider never called)', async () => {
    if (!dbReachable) return;
    const alice = await registerUser('alice');
    const bob = await registerUser('bob');
    const trip = await createTrip(alice.accessToken, {
      startsOn: '2026-11-01',
      endsOn: '2026-11-04',
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/trips/${trip.id}/stays`,
      headers: { authorization: `Bearer ${bob.accessToken}` },
    });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).code).toBe('TRIP_NOT_FOUND');
    expect(stub.calls).toHaveLength(0);
  });

  it('unauthenticated → 401 UNAUTHENTICATED', async () => {
    if (!dbReachable) return;
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/trips/whatever/stays',
    });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).code).toBe('UNAUTHENTICATED');
    expect(stub.calls).toHaveLength(0);
  });
});
