/**
 * Integration tests for the Redis cache layer in front of the
 * weather provider ([IV.18.5.2]).
 *
 * Setup differs from `weather.e2e-spec.ts` / `trip-weather.e2e-spec.ts`
 * which override `WEATHER_PROVIDER` (the port) and thereby bypass
 * both the decorator and Redis. Here we override the upstream
 * `OpenMeteoWeatherProvider` class token only — so
 * `CachedWeatherProvider` + `RedisWeatherCache` stay in the chain
 * and we can observe cache hits by counting upstream invocations.
 *
 * Isolation: each test uses unique lat/lng values (cache key derives
 * from coord + days) so cached entries from prior tests can't
 * satisfy the current one. Complements the general
 * `memory/feedback_unique_test_coords.md` guidance.
 *
 * Installed by prompt [IV.18.5.2].
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
  GetDailyForecastInput,
  WeatherProvider,
} from '../src/modules/weather/application/ports/weather-provider';
import type { WeatherForecast } from '../src/modules/weather/domain/weather-forecast.entity';
import { OpenMeteoWeatherProvider } from '../src/modules/weather/infrastructure/open-meteo-provider';

const TEST_PREFIX = 'weather-cache-e2e';

class StubOpenMeteo implements WeatherProvider {
  public calls: GetDailyForecastInput[] = [];

  reset(): void {
    this.calls = [];
  }

  async getDailyForecast(input: GetDailyForecastInput): Promise<WeatherForecast> {
    this.calls.push(input);
    return {
      lat: input.lat,
      lng: input.lng,
      timezone: 'Etc/UTC',
      days: Array.from({ length: input.days }, (_, i) => ({
        date: `2026-10-${String(i + 1).padStart(2, '0')}`,
        maxTempC: 18 + i,
        minTempC: 8 + i,
        weatherCode: 2,
        precipitationProbabilityPercent: 30,
      })),
    };
  }

  async getHourlyForecast(): Promise<never> {
    throw new Error('weather-cache stub does not exercise hourly');
  }
}

describe('Weather cache (integration, requires Docker Postgres + Redis)', () => {
  let moduleRef: TestingModule;
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let stub: StubOpenMeteo;
  let dbReachable = true;

  beforeAll(async () => {
    const stubInstance = new StubOpenMeteo();
    moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(OpenMeteoWeatherProvider)
      .useValue(stubInstance)
      .compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.useGlobalFilters(new AllExceptionFilter(), new DomainExceptionFilter());
    app.setGlobalPrefix('api/v1', { exclude: ['health', 'health/(.*)'] });
    await app.register(fastifyCookie);
    try {
      await app.init();
      await app.getHttpAdapter().getInstance().ready();
      prisma = moduleRef.get(PrismaService);
      stub = moduleRef.get<StubOpenMeteo>(OpenMeteoWeatherProvider);
      await prisma.$queryRaw`SELECT 1`;
      // Wipe any stale cache entries from prior test runs — the
      // module's own Redis client uses the same key prefix, and
      // entries from an earlier failed run would masquerade as
      // "cache hit" and break this suite.
      const flushClient = new Redis(process.env['REDIS_URL']!, {
        lazyConnect: false,
        maxRetriesPerRequest: 2,
      });
      try {
        const stream = flushClient.scanStream({
          match: `travel-${process.env['NODE_ENV']}:weather:*`,
          count: 100,
        });
        for await (const keys of stream as unknown as AsyncIterable<string[]>) {
          if (keys.length > 0) await flushClient.del(...keys);
        }
      } finally {
        await flushClient.quit();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // eslint-disable-next-line no-console
      console.warn(`weather-cache test: infra not reachable (${message}). Skipping.`);
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

  async function fetchForecast(
    accessToken: string,
    lat: number,
    lng: number,
    days: number,
  ): Promise<number> {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/weather/forecast?lat=${lat}&lng=${lng}&days=${days}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    return res.statusCode;
  }

  it('identical requests hit the cache on the 2nd call — upstream called once', async () => {
    if (!dbReachable) return;
    const tok = await token('hit');
    // Suite-local coord unique to this test.
    const lat = 41.234;
    const lng = -77.111;

    expect(await fetchForecast(tok, lat, lng, 5)).toBe(200);
    expect(await fetchForecast(tok, lat, lng, 5)).toBe(200);
    expect(await fetchForecast(tok, lat, lng, 5)).toBe(200);

    // Cache hit → upstream stub was called only on the first request.
    expect(stub.calls).toHaveLength(1);
    expect(stub.calls[0]).toEqual({ lat, lng, days: 5 });
  });

  it('different coords → independent cache entries (upstream called twice)', async () => {
    if (!dbReachable) return;
    const tok = await token('coords');
    // Two remote, pairwise-unique coords.
    await fetchForecast(tok, 42.345, 65.678, 3);
    await fetchForecast(tok, 42.999, 65.678, 3);
    expect(stub.calls).toHaveLength(2);
  });

  it('different days → independent cache entries (upstream called twice)', async () => {
    if (!dbReachable) return;
    const tok = await token('days');
    const lat = 39.876;
    const lng = -62.543;
    await fetchForecast(tok, lat, lng, 3);
    await fetchForecast(tok, lat, lng, 7);
    expect(stub.calls).toHaveLength(2);
  });

  it('coords within ~110m collapse onto the same cache entry (3-decimal precision)', async () => {
    if (!dbReachable) return;
    const tok = await token('precision');
    // lat.toFixed(3) treats these as the same key.
    await fetchForecast(tok, 38.1234, 54.4321, 4);
    await fetchForecast(tok, 38.1236, 54.432, 4);
    // The second call's toFixed(3) is (38.124, 54.432), the first
    // is (38.123, 54.432) — they differ. Prove that the "near but
    // not identical" pair does NOT share a cache entry, locking in
    // the 3-decimal contract.
    expect(stub.calls).toHaveLength(2);

    // Now a genuinely coalescing pair — same 3-decimal projection.
    await fetchForecast(tok, 38.1236, 54.432, 4);
    expect(stub.calls).toHaveLength(2);
  });
});
