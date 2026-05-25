/**
 * Integration tests for `GET /trips/:id/weather` ([IV.18.5.3]).
 *
 * Exercises the cross-module wiring: Trip use-case pulls
 * `trip.center` via `GeoQueries.findTripCenter`, then calls into
 * WeatherModule's `GetForecastUseCase`. Provider is stubbed at the
 * `WEATHER_PROVIDER` token so CI doesn't hit Open-Meteo.
 *
 * Installed by prompt [IV.18.5.3].
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
  type WeatherProvider,
} from '../src/modules/weather/application/ports/weather-provider';
import type { WeatherForecast } from '../src/modules/weather/domain/weather-forecast.entity';
import { uniqueEmail } from './factories';

const TEST_PREFIX = 'trip-weather-e2e';
// Suite-local coord far from any other test's Place rows.
const REMOTE = { lat: -8.6543, lng: -112.3456 };

class StubWeatherProvider implements WeatherProvider {
  public calls: GetDailyForecastInput[] = [];

  reset(): void {
    this.calls = [];
  }

  async getDailyForecast(input: GetDailyForecastInput): Promise<WeatherForecast> {
    this.calls.push(input);
    const days = Array.from({ length: input.days }, (_, i) => ({
      date: `2026-09-${String(i + 1).padStart(2, '0')}`,
      maxTempC: 20 + i,
      minTempC: 10 + i,
      weatherCode: 1,
      precipitationProbabilityPercent: 20,
    }));
    return { lat: input.lat, lng: input.lng, timezone: 'Etc/UTC', days };
  }

  async getHourlyForecast(): Promise<never> {
    throw new Error('trip-weather stub does not exercise hourly');
  }
}

describe('Trip × Weather (integration, requires Docker Postgres)', () => {
  let moduleRef: TestingModule;
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let stub: StubWeatherProvider;

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
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    prisma = moduleRef.get(PrismaService);
    stub = moduleRef.get<StubWeatherProvider>(WEATHER_PROVIDER);
    await prisma.$queryRaw`SELECT 1`;
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
    extra?: { startsOn?: string; endsOn?: string },
  ): Promise<{ id: string }> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/trips',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        title: 'Weather test trip',
        center: REMOTE,
        radiusKm: 5,
        ...(extra?.startsOn ? { startsOn: extra.startsOn } : {}),
        ...(extra?.endsOn ? { endsOn: extra.endsOn } : {}),
      },
    });
    expect(res.statusCode).toBe(201);
    return { id: (JSON.parse(res.body) as { id: string }).id };
  }

  it('GET /trips/:id/weather passes trip.center + trip-duration days to the provider', async () => {
    const { accessToken } = await registerUser('ok');
    const trip = await createTrip(accessToken, {
      startsOn: '2026-08-01',
      endsOn: '2026-08-04',
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/trips/${trip.id}/weather`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { forecast: WeatherForecast };
    expect(body.forecast.lat).toBeCloseTo(REMOTE.lat, 4);
    expect(body.forecast.lng).toBeCloseTo(REMOTE.lng, 4);
    expect(body.forecast.days).toHaveLength(4); // startsOn→endsOn inclusive

    expect(stub.calls).toHaveLength(1);
    const call = stub.calls[0]!;
    expect(call.lat).toBeCloseTo(REMOTE.lat, 4);
    expect(call.lng).toBeCloseTo(REMOTE.lng, 4);
    expect(call.days).toBe(4);
  });

  it('defaults to 7 days when the trip has no startsOn/endsOn', async () => {
    const { accessToken } = await registerUser('default');
    const trip = await createTrip(accessToken);

    await app.inject({
      method: 'GET',
      url: `/api/v1/trips/${trip.id}/weather`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(stub.calls[0]!.days).toBe(7);
  });

  it('clamps trip duration > 16 days to 16 (Open-Meteo ceiling)', async () => {
    const { accessToken } = await registerUser('clamp');
    const trip = await createTrip(accessToken, {
      startsOn: '2026-08-01',
      endsOn: '2026-08-25', // 25 days inclusive
    });

    await app.inject({
      method: 'GET',
      url: `/api/v1/trips/${trip.id}/weather`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(stub.calls[0]!.days).toBe(16);
  });

  it('non-owner → 404 TRIP_NOT_FOUND (IDOR defence)', async () => {
    const alice = await registerUser('alice');
    const bob = await registerUser('bob');
    const trip = await createTrip(alice.accessToken);

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/trips/${trip.id}/weather`,
      headers: { authorization: `Bearer ${bob.accessToken}` },
    });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).code).toBe('TRIP_NOT_FOUND');
    // Provider must not have been called on the failed auth path.
    expect(stub.calls).toHaveLength(0);
  });

  it('missing trip id → 404 TRIP_NOT_FOUND', async () => {
    const { accessToken } = await registerUser('missing');
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/trips/does-not-exist-cuid/weather',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).code).toBe('TRIP_NOT_FOUND');
    expect(stub.calls).toHaveLength(0);
  });

  it('unauthenticated → 401 UNAUTHENTICATED', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/trips/whatever/weather',
    });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).code).toBe('UNAUTHENTICATED');
    expect(stub.calls).toHaveLength(0);
  });
});
