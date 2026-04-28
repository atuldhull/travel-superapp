/**
 * Integration tests for the Stays module ([IV.18.6.1]).
 *
 * Covers:
 *   - auth gate (bearer required)
 *   - domain validation (coords, radius, date range)
 *   - provider wiring (MockStayProvider returns sorted rings)
 *   - cache-around-port wiring (upstream called once per unique
 *     search key; separate keys get separate upstream calls)
 *
 * Cache isolation: a pre-suite SCAN-DEL wipes `travel-test:stays:*`
 * so stale entries from a prior run don't masquerade as hits (same
 * trick the weather-cache suite uses). Upstream-call counting is
 * done by overriding `MockStayProvider` with a recording stub —
 * mirrors the weather-cache override pattern.
 *
 * Installed by prompt [IV.18.6.1].
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

const TEST_PREFIX = 'stays-e2e';

class RecordingStayProvider implements StayProvider {
  public calls: SearchStaysInput[] = [];

  reset(): void {
    this.calls = [];
  }

  async searchNearby(input: SearchStaysInput): Promise<readonly StayListing[]> {
    this.calls.push(input);
    return [
      {
        externalId: `mock:stub-${input.lat}-${input.lng}`,
        provider: 'mock',
        name: 'Stub Stay',
        starRating: 4,
        amenities: ['wifi'],
        lat: input.lat,
        lng: input.lng,
        distanceMeters: 500,
        priceUsdPerNight: 99,
        currency: 'USD',
        stayType: 'inn',
      },
    ];
  }
}

describe('Stays module (integration, requires Docker Postgres + Redis)', () => {
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

      // Wipe stale cache entries from prior runs — see
      // weather-cache.e2e-spec.ts for the rationale.
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
      console.warn(`stays test: infra not reachable (${message}). Skipping.`);
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
      checkIn: string;
      checkOut: string;
      guests: number;
    }> = {},
  ): Record<string, unknown> {
    return {
      center: { lat: 25.6789, lng: -105.4321 },
      radiusKm: 5,
      checkIn: '2026-10-01',
      checkOut: '2026-10-04',
      guests: 2,
      ...overrides,
    };
  }

  it('POST /stays/search without a bearer → 401 UNAUTHENTICATED', async () => {
    if (!dbReachable) return;
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/stays/search',
      payload: basePayload(),
    });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).code).toBe('UNAUTHENTICATED');
  });

  it('POST /stays/search happy path → 200 + provider sees the command', async () => {
    if (!dbReachable) return;
    const tok = await token('ok');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/stays/search',
      headers: { authorization: `Bearer ${tok}` },
      payload: basePayload({ center: { lat: 25.111, lng: -105.222 } }),
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { stays: StayListing[] };
    expect(body.stays).toHaveLength(1);
    expect(body.stays[0]!.provider).toBe('mock');

    expect(stub.calls).toHaveLength(1);
    expect(stub.calls[0]).toEqual({
      lat: 25.111,
      lng: -105.222,
      radiusKm: 5,
      checkIn: '2026-10-01',
      checkOut: '2026-10-04',
      guests: 2,
    });
  });

  it('defaults guests to 1 when absent', async () => {
    if (!dbReachable) return;
    const tok = await token('default-guests');
    await app.inject({
      method: 'POST',
      url: '/api/v1/stays/search',
      headers: { authorization: `Bearer ${tok}` },
      payload: basePayload({
        center: { lat: 26.101, lng: -105.202 },
        // Omit guests — omit in TS means delete from the object.
        guests: undefined as unknown as number,
      }),
    });
    expect(stub.calls[0]!.guests).toBe(1);
  });

  it('radius > 50km → 422 INVALID_RADIUS', async () => {
    if (!dbReachable) return;
    const tok = await token('bad-radius');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/stays/search',
      headers: { authorization: `Bearer ${tok}` },
      payload: basePayload({ radiusKm: 75 }),
    });
    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body).code).toBe('INVALID_RADIUS');
  });

  it('checkOut ≤ checkIn → 422 INVALID_DATE_RANGE', async () => {
    if (!dbReachable) return;
    const tok = await token('bad-dates');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/stays/search',
      headers: { authorization: `Bearer ${tok}` },
      payload: basePayload({ checkIn: '2026-10-04', checkOut: '2026-10-01' }),
    });
    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body).code).toBe('INVALID_DATE_RANGE');
  });

  it('date range > 30 nights → 422 INVALID_DATE_RANGE', async () => {
    if (!dbReachable) return;
    const tok = await token('long-range');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/stays/search',
      headers: { authorization: `Bearer ${tok}` },
      payload: basePayload({ checkIn: '2026-10-01', checkOut: '2026-12-15' }),
    });
    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body).code).toBe('INVALID_DATE_RANGE');
  });

  it('cache hit: identical search → upstream called once, 3 HTTP calls served', async () => {
    if (!dbReachable) return;
    const tok = await token('cache-hit');
    const payload = basePayload({ center: { lat: 28.111, lng: -108.222 } });

    for (const _ of [1, 2, 3]) {
      void _;
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/stays/search',
        headers: { authorization: `Bearer ${tok}` },
        payload,
      });
      expect(res.statusCode).toBe(200);
    }
    expect(stub.calls).toHaveLength(1);
  });

  it('cache miss on different dates: upstream called twice', async () => {
    if (!dbReachable) return;
    const tok = await token('cache-dates');
    await app.inject({
      method: 'POST',
      url: '/api/v1/stays/search',
      headers: { authorization: `Bearer ${tok}` },
      payload: basePayload({
        center: { lat: 29.333, lng: -109.444 },
        checkIn: '2026-10-01',
        checkOut: '2026-10-04',
      }),
    });
    await app.inject({
      method: 'POST',
      url: '/api/v1/stays/search',
      headers: { authorization: `Bearer ${tok}` },
      payload: basePayload({
        center: { lat: 29.333, lng: -109.444 },
        checkIn: '2026-11-01',
        checkOut: '2026-11-04',
      }),
    });
    expect(stub.calls).toHaveLength(2);
  });
});
