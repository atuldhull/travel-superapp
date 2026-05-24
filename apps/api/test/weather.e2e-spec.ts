/**
 * Integration tests for the Weather module ([IV.18.5.1]).
 *
 * Overrides `WEATHER_PROVIDER` with an in-memory stub so tests never
 * hit the real Open-Meteo API (no network dependency in CI, and no
 * provider-quota cost on a hot PR loop). The override proves the
 * port/adapter pattern at the same time — exactly the swap a future
 * paid-provider slice would do.
 *
 * DB is still required because `AppModule` boots the full graph —
 * we auth through the normal register + access-token path.
 *
 * Installed by prompt [IV.18.5.1].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';
import {
  WEATHER_PROVIDER,
  type GetDailyForecastInput,
  type GetHourlyForecastInput,
  type WeatherProvider,
} from '../src/modules/weather/application/ports/weather-provider';
import type {
  HourlyWeatherForecast,
  WeatherForecast,
} from '../src/modules/weather/domain/weather-forecast.entity';
import { uniqueEmail } from './factories';

const TEST_PREFIX = 'weather-e2e';

// A tiny stub that records every call + returns a canned forecast.
// Mutable so individual tests can reshape its behaviour without a
// full module re-compile.
class StubWeatherProvider implements WeatherProvider {
  public calls: GetDailyForecastInput[] = [];
  public hourlyCalls: GetHourlyForecastInput[] = [];
  public nextResponse: WeatherForecast | null = null;
  public nextHourlyResponse: HourlyWeatherForecast | null = null;
  public nextError: Error | null = null;

  reset(): void {
    this.calls = [];
    this.hourlyCalls = [];
    this.nextResponse = null;
    this.nextHourlyResponse = null;
    this.nextError = null;
  }

  async getDailyForecast(input: GetDailyForecastInput): Promise<WeatherForecast> {
    this.calls.push(input);
    if (this.nextError) throw this.nextError;
    if (this.nextResponse) return this.nextResponse;
    // Default: one dummy day.
    return {
      lat: input.lat,
      lng: input.lng,
      timezone: 'Etc/UTC',
      days: [
        {
          date: '2026-09-01',
          maxTempC: 22.4,
          minTempC: 11.8,
          weatherCode: 1,
          precipitationProbabilityPercent: 10,
        },
      ],
    };
  }

  async getHourlyForecast(input: GetHourlyForecastInput): Promise<HourlyWeatherForecast> {
    this.hourlyCalls.push(input);
    if (this.nextError) throw this.nextError;
    if (this.nextHourlyResponse) return this.nextHourlyResponse;
    return {
      lat: input.lat,
      lng: input.lng,
      timezone: 'Etc/UTC',
      hours: Array.from({ length: input.hours }, (_, i) => ({
        time: `2026-09-01T${String(i % 24).padStart(2, '0')}:00`,
        tempC: 18 + (i % 12),
        precipitationProbabilityPercent: 10,
        windSpeedKmh: 12,
        weatherCode: 1,
      })),
    };
  }
}

describe('Weather module (integration, requires Docker Postgres)', () => {
  let moduleRef: TestingModule;
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let stub: StubWeatherProvider;
  let dbReachable = true;

  beforeAll(async () => {
    const stubInstance = new StubWeatherProvider();
    moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(WEATHER_PROVIDER)
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
      stub = moduleRef.get<StubWeatherProvider>(WEATHER_PROVIDER);
      await prisma.$queryRaw`SELECT 1`;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // eslint-disable-next-line no-console
      console.warn(`weather test: DB not reachable (${message}). Skipping.`);
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

  async function accessToken(suffix: string): Promise<string> {
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
    return (JSON.parse(res.body) as { accessToken: string }).accessToken;
  }

  it('GET /weather/forecast without a bearer → 401 UNAUTHENTICATED', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/weather/forecast?lat=51.5&lng=-0.14',
    });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).code).toBe('UNAUTHENTICATED');
  });

  it('GET /weather/forecast with valid coords → 200 + passes lat/lng/days to the provider', async () => {
    const token = await accessToken('ok');

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/weather/forecast?lat=51.5&lng=-0.14&days=3',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      lat: number;
      lng: number;
      timezone: string;
      days: Array<{
        date: string;
        maxTempC: number;
        minTempC: number;
        weatherCode: number;
        precipitationProbabilityPercent: number | null;
      }>;
    };
    expect(body.lat).toBeCloseTo(51.5, 4);
    expect(body.lng).toBeCloseTo(-0.14, 4);
    expect(body.timezone).toBe('Etc/UTC');
    expect(body.days).toHaveLength(1);
    expect(body.days[0]!.maxTempC).toBe(22.4);

    expect(stub.calls).toHaveLength(1);
    expect(stub.calls[0]).toEqual({ lat: 51.5, lng: -0.14, days: 3 });
  });

  it('defaults `days` to 7 when the query param is absent', async () => {
    const token = await accessToken('default-days');
    await app.inject({
      method: 'GET',
      url: '/api/v1/weather/forecast?lat=10&lng=10',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(stub.calls[0]!.days).toBe(7);
  });

  it('clamps `days` above 16 to 16 (Open-Meteo ceiling)', async () => {
    const token = await accessToken('clamp');
    await app.inject({
      method: 'GET',
      url: '/api/v1/weather/forecast?lat=10&lng=10&days=50',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(stub.calls[0]!.days).toBe(16);
  });

  it('rejects lat > 90 with 422 VALIDATION_FAILED', async () => {
    const token = await accessToken('bad-lat');
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/weather/forecast?lat=999&lng=10',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body).code).toBe('VALIDATION_FAILED');
  });

  it('rejects non-numeric lng with 422 VALIDATION_FAILED', async () => {
    const token = await accessToken('bad-lng');
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/weather/forecast?lat=10&lng=not-a-number',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body).code).toBe('VALIDATION_FAILED');
  });

  it('upstream provider failure → 502 EXTERNAL_SERVICE_FAILED (or WEATHER_PROVIDER_UNAVAILABLE)', async () => {
    const token = await accessToken('upstream-fail');
    stub.nextError = new (await import('@app/errors')).ExternalServiceError(
      'open-meteo',
      'simulated_outage',
      {},
      'WEATHER_PROVIDER_UNAVAILABLE',
    );

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/weather/forecast?lat=10&lng=10',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(502);
    expect(JSON.parse(res.body).code).toBe('WEATHER_PROVIDER_UNAVAILABLE');
  });

  // V.UX.21 — hourly forecast surface for the adventure persona.
  it('GET /weather/forecast/hourly without bearer → 401 UNAUTHENTICATED', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/weather/forecast/hourly?lat=10&lng=10',
    });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).code).toBe('UNAUTHENTICATED');
  });

  it('GET /weather/forecast/hourly returns 24 hourly buckets with the expected fields', async () => {
    const token = await accessToken('hourly-default');
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/weather/forecast/hourly?lat=51.5&lng=-0.1',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as HourlyWeatherForecast;
    expect(body.lat).toBe(51.5);
    expect(body.lng).toBe(-0.1);
    expect(body.hours).toHaveLength(24);
    for (const h of body.hours) {
      expect(typeof h.time).toBe('string');
      expect(typeof h.tempC).toBe('number');
      expect(typeof h.weatherCode).toBe('number');
      expect(['number']).toContain(typeof h.windSpeedKmh);
      expect(['number']).toContain(typeof h.precipitationProbabilityPercent);
    }
    expect(stub.hourlyCalls.at(-1)?.hours).toBe(24);
  });

  it('clamps `hours` above 48 to 48', async () => {
    const token = await accessToken('hourly-clamp');
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/weather/forecast/hourly?lat=10&lng=10&hours=72',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as HourlyWeatherForecast;
    expect(body.hours).toHaveLength(48);
    expect(stub.hourlyCalls.at(-1)?.hours).toBe(48);
  });

  it('rejects lat > 90 with 422 VALIDATION_FAILED on the hourly endpoint', async () => {
    const token = await accessToken('hourly-bad-lat');
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/weather/forecast/hourly?lat=120&lng=10',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(422);
  });

  it('hourly upstream failure → 502 WEATHER_PROVIDER_UNAVAILABLE', async () => {
    const token = await accessToken('hourly-fail');
    stub.nextError = new (await import('@app/errors')).ExternalServiceError(
      'open-meteo',
      'simulated_outage',
      {},
      'WEATHER_PROVIDER_UNAVAILABLE',
    );
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/weather/forecast/hourly?lat=10&lng=10',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(502);
    expect(JSON.parse(res.body).code).toBe('WEATHER_PROVIDER_UNAVAILABLE');
  });
});
