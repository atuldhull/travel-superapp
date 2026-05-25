/**
 * Integration tests for `GET /trips/:id/events` ([IV.18.9.2]).
 *
 * Fourth cross-module fold-in on Trip. Same test shape as
 * trip-weather / trip-stays / trip-eateries — override the upstream
 * `MockEventProvider` so the cache + decorator stay in the chain
 * but upstream invocations are countable.
 *
 * Installed by prompt [IV.18.9.2].
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
  EventProvider,
  SearchEventsInput,
} from '../src/modules/events/application/ports/event-provider';
import type { EventListing } from '../src/modules/events/domain/event-listing.entity';
import { MockEventProvider } from '../src/modules/events/infrastructure/mock-event-provider';
import { uniqueEmail } from './factories';

const TEST_PREFIX = 'trip-events-e2e';
// Remote South-Pacific coord — distinct from other Trip suites.
const REMOTE = { lat: -27.1234, lng: -156.5678 };

class RecordingEventProvider implements EventProvider {
  public calls: SearchEventsInput[] = [];

  reset(): void {
    this.calls = [];
  }

  async searchNearby(input: SearchEventsInput): Promise<readonly EventListing[]> {
    this.calls.push(input);
    const fromMs = Date.parse(input.from);
    return [
      {
        externalId: `mock:trip-event-${input.lat}-${input.lng}`,
        provider: 'mock',
        title: 'Trip Event Stub',
        description: null,
        category: input.category ?? 'music',
        venueName: 'Stub Venue',
        lat: input.lat,
        lng: input.lng,
        distanceMeters: 450,
        startsAt: new Date(fromMs + 3 * 3_600_000).toISOString(),
        endsAt: new Date(fromMs + 5 * 3_600_000).toISOString(),
        currency: 'USD',
        priceMin: '20.00',
        priceMax: '40.00',
        sourceUrl: null,
      },
    ];
  }
}

describe('Trip × Events (integration, requires Docker Postgres + Redis)', () => {
  let moduleRef: TestingModule;
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let stub: RecordingEventProvider;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MockEventProvider)
      .useValue(new RecordingEventProvider())
      .compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.useGlobalFilters(new AllExceptionFilter(), new DomainExceptionFilter());
    app.setGlobalPrefix('api/v1', { exclude: ['health', 'health/(.*)'] });
    await app.register(fastifyCookie);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    prisma = moduleRef.get(PrismaService);
    stub = moduleRef.get<RecordingEventProvider>(MockEventProvider);
    await prisma.$queryRaw`SELECT 1`;

    const flush = new Redis(process.env['REDIS_URL']!, {
      lazyConnect: false,
      maxRetriesPerRequest: 2,
    });
    try {
      const stream = flush.scanStream({
        match: `travel-${process.env['NODE_ENV']}:events:*`,
        count: 100,
      });
      for await (const keys of stream as unknown as AsyncIterable<string[]>) {
        if (keys.length > 0) await flush.del(...keys);
      }
    } finally {
      await flush.quit();
    }
  });

  afterEach(async () => {
    stub.reset();
    await prisma.user.deleteMany({
      where: { displayName: { startsWith: TEST_PREFIX } },
    });
  });

  afterAll(async () => {
    await app.close();
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

  async function createTrip(
    accessToken: string,
    extra?: { startsOn?: string; endsOn?: string; radiusKm?: number },
  ): Promise<{ id: string }> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/trips',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        title: 'Events test trip',
        center: REMOTE,
        radiusKm: extra?.radiusKm ?? 4,
        ...(extra?.startsOn ? { startsOn: extra.startsOn } : {}),
        ...(extra?.endsOn ? { endsOn: extra.endsOn } : {}),
      },
    });
    expect(res.statusCode).toBe(201);
    return { id: (JSON.parse(res.body) as { id: string }).id };
  }

  it('GET /trips/:id/events passes trip.center + trip dates (full-day bounds) to the provider', async () => {
    const { accessToken } = await registerUser('ok');
    const trip = await createTrip(accessToken, {
      startsOn: '2026-08-01',
      endsOn: '2026-08-04',
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/trips/${trip.id}/events`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { events: EventListing[] };
    expect(body.events).toHaveLength(1);

    expect(stub.calls).toHaveLength(1);
    const call = stub.calls[0]!;
    expect(call.lat).toBeCloseTo(REMOTE.lat, 4);
    expect(call.lng).toBeCloseTo(REMOTE.lng, 4);
    expect(call.radiusKm).toBe(4);
    // from = startsOn @ 00:00 UTC; to = endsOn + 23:59:59.999 for inclusive end-of-day.
    expect(call.from).toBe('2026-08-01T00:00:00.000Z');
    expect(Date.parse(call.to)).toBeGreaterThan(Date.parse('2026-08-04T23:59:00.000Z'));
    expect(Date.parse(call.to)).toBeLessThan(Date.parse('2026-08-05T00:00:01.000Z'));
  });

  it('?category=music flows through to the provider', async () => {
    const { accessToken } = await registerUser('category');
    const trip = await createTrip(accessToken, {
      startsOn: '2026-09-01',
      endsOn: '2026-09-03',
    });

    await app.inject({
      method: 'GET',
      url: `/api/v1/trips/${trip.id}/events?category=music`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(stub.calls[0]!.category).toBe('music');
  });

  it('trip.radiusKm > 30 is clamped to 30 at the provider call', async () => {
    const { accessToken } = await registerUser('clamp');
    const trip = await createTrip(accessToken, {
      startsOn: '2026-10-01',
      endsOn: '2026-10-02',
      radiusKm: 200,
    });

    await app.inject({
      method: 'GET',
      url: `/api/v1/trips/${trip.id}/events`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(stub.calls[0]!.radiusKm).toBe(30);
  });

  it('trip without dates → 422 TRIP_DATES_REQUIRED (provider never called)', async () => {
    const { accessToken } = await registerUser('no-dates');
    const trip = await createTrip(accessToken); // no dates

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/trips/${trip.id}/events`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body).code).toBe('TRIP_DATES_REQUIRED');
    expect(stub.calls).toHaveLength(0);
  });

  it('non-owner → 404 TRIP_NOT_FOUND (provider never called)', async () => {
    const alice = await registerUser('alice');
    const bob = await registerUser('bob');
    const trip = await createTrip(alice.accessToken, {
      startsOn: '2026-11-01',
      endsOn: '2026-11-03',
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/trips/${trip.id}/events`,
      headers: { authorization: `Bearer ${bob.accessToken}` },
    });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).code).toBe('TRIP_NOT_FOUND');
    expect(stub.calls).toHaveLength(0);
  });

  it('unauthenticated → 401 UNAUTHENTICATED (provider never called)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/trips/whatever/events',
    });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).code).toBe('UNAUTHENTICATED');
    expect(stub.calls).toHaveLength(0);
  });
});
