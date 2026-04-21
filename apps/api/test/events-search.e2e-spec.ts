/**
 * Integration tests for the Events module ([IV.18.9.1]).
 *
 * Named `events-search` to avoid collision with the existing
 * `events.e2e-spec.ts` (which tests the domain event bus).
 *
 * Same structural shape as the other provider-backed module tests —
 * override the upstream `MockEventProvider` class token with a
 * recorder so decorator + Redis cache stay in the chain.
 *
 * Installed by prompt [IV.18.9.1].
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

const TEST_PREFIX = 'events-search-e2e';

class RecordingEventProvider implements EventProvider {
  public calls: SearchEventsInput[] = [];

  reset(): void {
    this.calls = [];
  }

  async searchNearby(input: SearchEventsInput): Promise<readonly EventListing[]> {
    this.calls.push(input);
    const fromMs = Date.parse(input.from);
    const all: EventListing[] = [
      {
        externalId: 'mock:jazz',
        provider: 'mock',
        title: 'Jazz Night',
        description: null,
        category: 'music',
        venueName: 'The Cellar',
        lat: input.lat,
        lng: input.lng,
        distanceMeters: 300,
        startsAt: new Date(fromMs + 4 * 3_600_000).toISOString(),
        endsAt: new Date(fromMs + 7 * 3_600_000).toISOString(),
        currency: 'USD',
        priceMin: '15.00',
        priceMax: '25.00',
        sourceUrl: null,
      },
      {
        externalId: 'mock:market',
        provider: 'mock',
        title: 'Farmers Market',
        description: null,
        category: 'market',
        venueName: 'Town Square',
        lat: input.lat,
        lng: input.lng,
        distanceMeters: 1_000,
        startsAt: new Date(fromMs + 10 * 3_600_000).toISOString(),
        endsAt: new Date(fromMs + 15 * 3_600_000).toISOString(),
        currency: null,
        priceMin: null,
        priceMax: null,
        sourceUrl: null,
      },
    ];
    return all.filter((e) => (input.category ? e.category === input.category.toLowerCase() : true));
  }
}

describe('Events module (integration, requires Docker Postgres + Redis)', () => {
  let moduleRef: TestingModule;
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let stub: RecordingEventProvider;
  let dbReachable = true;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MockEventProvider)
      .useValue(new RecordingEventProvider())
      .compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.useGlobalFilters(new AllExceptionFilter(), new DomainExceptionFilter());
    app.setGlobalPrefix('api/v1', { exclude: ['health', 'health/(.*)'] });
    await app.register(fastifyCookie);
    try {
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
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // eslint-disable-next-line no-console
      console.warn(`events-search test: infra not reachable (${message}). Skipping.`);
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

  async function token(suffix: string): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: `${TEST_PREFIX}-${suffix}-${Date.now()}@example.com`,
        password: 'correct-horse-battery-staple',
        displayName: `${TEST_PREFIX}-${suffix}`,
      },
    });
    expect(res.statusCode).toBe(201);
    return (JSON.parse(res.body) as { accessToken: string }).accessToken;
  }

  function basePayload(
    overrides: Partial<{
      center: { lat: number; lng: number };
      radiusKm: number;
      from: string;
      to: string;
      category: string;
    }> = {},
  ): Record<string, unknown> {
    return {
      center: { lat: 19.2345, lng: -84.5678 },
      radiusKm: 5,
      from: '2026-12-01T00:00:00Z',
      to: '2026-12-03T00:00:00Z',
      ...overrides,
    };
  }

  it('POST /events/search without a bearer → 401 UNAUTHENTICATED', async () => {
    if (!dbReachable) return;
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/events/search',
      payload: basePayload(),
    });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).code).toBe('UNAUTHENTICATED');
  });

  it('happy path → 200 with events + provider input echoed', async () => {
    if (!dbReachable) return;
    const tok = await token('ok');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/events/search',
      headers: { authorization: `Bearer ${tok}` },
      payload: basePayload({ center: { lat: 19.111, lng: -84.222 } }),
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { events: EventListing[] };
    expect(body.events.length).toBeGreaterThan(0);

    expect(stub.calls).toHaveLength(1);
    expect(stub.calls[0]!.lat).toBeCloseTo(19.111, 4);
    expect(stub.calls[0]!.lng).toBeCloseTo(-84.222, 4);
    expect(stub.calls[0]!.from).toBe('2026-12-01T00:00:00Z');
    expect(stub.calls[0]!.to).toBe('2026-12-03T00:00:00Z');
    expect(stub.calls[0]!.category).toBeUndefined();
  });

  it('category filter flows through + narrows results', async () => {
    if (!dbReachable) return;
    const tok = await token('cat');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/events/search',
      headers: { authorization: `Bearer ${tok}` },
      payload: basePayload({
        center: { lat: 20.111, lng: -85.222 },
        category: 'music',
      }),
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { events: EventListing[] };
    expect(body.events.every((e) => e.category === 'music')).toBe(true);
    expect(stub.calls[0]!.category).toBe('music');
  });

  it('radius > 30km → 422 INVALID_RADIUS', async () => {
    if (!dbReachable) return;
    const tok = await token('bad-radius');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/events/search',
      headers: { authorization: `Bearer ${tok}` },
      payload: basePayload({ radiusKm: 50 }),
    });
    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body).code).toBe('INVALID_RADIUS');
  });

  it('to ≤ from → 422 INVALID_DATE_RANGE', async () => {
    if (!dbReachable) return;
    const tok = await token('bad-range');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/events/search',
      headers: { authorization: `Bearer ${tok}` },
      payload: basePayload({
        from: '2026-12-03T00:00:00Z',
        to: '2026-12-01T00:00:00Z',
      }),
    });
    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body).code).toBe('INVALID_DATE_RANGE');
  });

  it('window > 90 days → 422 INVALID_DATE_RANGE', async () => {
    if (!dbReachable) return;
    const tok = await token('long-window');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/events/search',
      headers: { authorization: `Bearer ${tok}` },
      payload: basePayload({
        from: '2026-12-01T00:00:00Z',
        to: '2027-04-01T00:00:00Z',
      }),
    });
    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body).code).toBe('INVALID_DATE_RANGE');
  });

  it('cache hit: identical search → upstream called once across 3 HTTP requests', async () => {
    if (!dbReachable) return;
    const tok = await token('cache-hit');
    const payload = basePayload({ center: { lat: 21.111, lng: -86.222 } });
    for (const _ of [1, 2, 3]) {
      void _;
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/events/search',
        headers: { authorization: `Bearer ${tok}` },
        payload,
      });
      expect(res.statusCode).toBe(200);
    }
    expect(stub.calls).toHaveLength(1);
  });

  it('cache miss: different window → separate upstream call', async () => {
    if (!dbReachable) return;
    const tok = await token('cache-window');
    await app.inject({
      method: 'POST',
      url: '/api/v1/events/search',
      headers: { authorization: `Bearer ${tok}` },
      payload: basePayload({
        center: { lat: 22.111, lng: -87.222 },
        from: '2026-12-01T00:00:00Z',
        to: '2026-12-03T00:00:00Z',
      }),
    });
    await app.inject({
      method: 'POST',
      url: '/api/v1/events/search',
      headers: { authorization: `Bearer ${tok}` },
      payload: basePayload({
        center: { lat: 22.111, lng: -87.222 },
        from: '2027-01-01T00:00:00Z',
        to: '2027-01-03T00:00:00Z',
      }),
    });
    expect(stub.calls).toHaveLength(2);
  });
});
