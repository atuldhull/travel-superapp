/**
 * Integration tests for `GET /trips/:id/overview` ([IV.18.7.3]).
 *
 * Bundles trip + itinerary + weather + stays + eateries + events
 * into one response with per-section graceful degradation. Every
 * external provider is stubbed so the cache + decorator stay in the
 * chain and upstream invocations are countable.
 *
 * Installed by prompt [IV.18.7.3]; events section added in
 * prompt [IV.18.7.5].
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
import type {
  EateryProvider,
  SearchEateriesInput,
} from '../src/modules/food/application/ports/eatery-provider';
import type { EateryListing } from '../src/modules/food/domain/eatery-listing.entity';
import { MockEateryProvider } from '../src/modules/food/infrastructure/mock-eatery-provider';
import type {
  SearchStaysInput,
  StayProvider,
} from '../src/modules/stays/application/ports/stay-provider';
import type { StayListing } from '../src/modules/stays/domain/stay-listing.entity';
import { MockStayProvider } from '../src/modules/stays/infrastructure/mock-stay-provider';
import {
  WEATHER_PROVIDER,
  type GetDailyForecastInput,
  type WeatherProvider,
} from '../src/modules/weather/application/ports/weather-provider';
import type { WeatherForecast } from '../src/modules/weather/domain/weather-forecast.entity';
import { uniqueEmail } from './factories';

const TEST_PREFIX = 'overview-e2e';
// Remote South Atlantic coord — no overlap with other suites.
const REMOTE = { lat: -31.2345, lng: -17.8901 };

class StubWeather implements WeatherProvider {
  public shouldFail = false;
  async getDailyForecast(input: GetDailyForecastInput): Promise<WeatherForecast> {
    if (this.shouldFail) throw new Error('weather upstream down');
    return {
      lat: input.lat,
      lng: input.lng,
      timezone: 'Etc/UTC',
      days: Array.from({ length: input.days }, (_, i) => ({
        date: `2026-12-${String(i + 1).padStart(2, '0')}`,
        maxTempC: 18,
        minTempC: 10,
        weatherCode: 1,
        precipitationProbabilityPercent: 15,
      })),
    };
  }
  async getHourlyForecast(): Promise<never> {
    throw new Error('overview stub does not exercise hourly');
  }
}

class StubStay implements StayProvider {
  async searchNearby(input: SearchStaysInput): Promise<readonly StayListing[]> {
    return [
      {
        externalId: `mock:overview-stay-${input.lat}`,
        provider: 'mock',
        name: 'Overview Stay',
        starRating: 4,
        amenities: ['wifi'],
        lat: input.lat,
        lng: input.lng,
        distanceMeters: 300,
        priceUsdPerNight: 110,
        currency: 'USD',
        stayType: 'inn',
        wifiSpeedMbps: 50,
      },
    ];
  }
}

class StubEatery implements EateryProvider {
  async searchNearby(input: SearchEateriesInput): Promise<readonly EateryListing[]> {
    return [
      {
        externalId: `mock:overview-eatery-${input.lat}`,
        provider: 'mock',
        name: 'Overview Eatery',
        cuisineTags: ['local'],
        priceTier: 2,
        lat: input.lat,
        lng: input.lng,
        distanceMeters: 400,
      },
    ];
  }
}

class StubEvent implements EventProvider {
  async searchNearby(input: SearchEventsInput): Promise<readonly EventListing[]> {
    const fromMs = Date.parse(input.from);
    return [
      {
        externalId: `mock:overview-event-${input.lat}`,
        provider: 'mock',
        title: 'Overview Event',
        description: null,
        category: 'music',
        venueName: 'Stub Venue',
        lat: input.lat,
        lng: input.lng,
        distanceMeters: 500,
        startsAt: new Date(fromMs + 3 * 3_600_000).toISOString(),
        endsAt: new Date(fromMs + 5 * 3_600_000).toISOString(),
        currency: 'USD',
        priceMin: '10.00',
        priceMax: '20.00',
        sourceUrl: null,
      },
    ];
  }
}

describe('Trip overview (integration, requires Docker Postgres + Redis)', () => {
  let moduleRef: TestingModule;
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let weatherStub: StubWeather;
  let dbReachable = true;

  beforeAll(async () => {
    const weather = new StubWeather();
    moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(WEATHER_PROVIDER)
      .useValue(weather)
      .overrideProvider(MockStayProvider)
      .useValue(new StubStay())
      .overrideProvider(MockEateryProvider)
      .useValue(new StubEatery())
      .overrideProvider(MockEventProvider)
      .useValue(new StubEvent())
      .compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.useGlobalFilters(new AllExceptionFilter(), new DomainExceptionFilter());
    app.setGlobalPrefix('api/v1', { exclude: ['health', 'health/(.*)'] });
    await app.register(fastifyCookie);
    try {
      await app.init();
      await app.getHttpAdapter().getInstance().ready();
      prisma = moduleRef.get(PrismaService);
      weatherStub = moduleRef.get<StubWeather>(WEATHER_PROVIDER);
      await prisma.$queryRaw`SELECT 1`;

      // Wipe stays + eateries caches so prior-run entries don't mask
      // the overview's sub-fetches for this suite's coord.
      const flush = new Redis(process.env['REDIS_URL']!, {
        lazyConnect: false,
        maxRetriesPerRequest: 2,
      });
      try {
        for (const ns of ['stays', 'eateries', 'weather', 'events']) {
          const stream = flush.scanStream({
            match: `travel-${process.env['NODE_ENV']}:${ns}:*`,
            count: 100,
          });
          for await (const keys of stream as unknown as AsyncIterable<string[]>) {
            if (keys.length > 0) await flush.del(...keys);
          }
        }
      } finally {
        await flush.quit();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // eslint-disable-next-line no-console
      console.warn(`overview test: infra not reachable (${message}). Skipping.`);
      dbReachable = false;
    }
  });

  afterEach(async () => {
    if (dbReachable) {
      weatherStub.shouldFail = false;
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
    extra?: { startsOn?: string; endsOn?: string },
  ): Promise<{ id: string }> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/trips',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        title: 'Overview test trip',
        center: REMOTE,
        radiusKm: 4,
        ...(extra?.startsOn ? { startsOn: extra.startsOn } : {}),
        ...(extra?.endsOn ? { endsOn: extra.endsOn } : {}),
      },
    });
    expect(res.statusCode).toBe(201);
    return { id: (JSON.parse(res.body) as { id: string }).id };
  }

  type OverviewBody = {
    trip: { id: string; title: string };
    itinerary: { ok: boolean; data?: { days: unknown[] }; code?: string };
    weather: { ok: boolean; data?: { forecast: { days: unknown[] } }; code?: string };
    stays: { ok: boolean; data?: { list: unknown[] }; code?: string };
    eateries: { ok: boolean; data?: { list: unknown[] }; code?: string };
    events: { ok: boolean; data?: { list: unknown[] }; code?: string };
  };

  it('bundles all five sections ok:true when trip has dates + itinerary generated', async () => {
    if (!dbReachable) return;
    const { accessToken } = await registerUser('full');
    const trip = await createTrip(accessToken, {
      startsOn: '2026-12-01',
      endsOn: '2026-12-04',
    });

    // Generate the itinerary so the itinerary section has data.
    await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${trip.id}/itinerary`,
      headers: { authorization: `Bearer ${accessToken}` },
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/trips/${trip.id}/overview`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as OverviewBody;

    expect(body.trip.id).toBe(trip.id);
    expect(body.trip.title).toBe('Overview test trip');

    expect(body.itinerary.ok).toBe(true);
    expect(body.itinerary.data!.days.length).toBeGreaterThan(0);

    expect(body.weather.ok).toBe(true);
    expect(body.weather.data!.forecast.days.length).toBe(4); // matches trip duration

    expect(body.stays.ok).toBe(true);
    expect(body.stays.data!.list.length).toBeGreaterThan(0);

    expect(body.eateries.ok).toBe(true);
    expect(body.eateries.data!.list.length).toBeGreaterThan(0);

    expect(body.events.ok).toBe(true);
    expect(body.events.data!.list.length).toBeGreaterThan(0);
  });

  it('dateless trip → stays + events sections ok:false with TRIP_DATES_REQUIRED, rest still ok', async () => {
    if (!dbReachable) return;
    const { accessToken } = await registerUser('no-dates');
    const trip = await createTrip(accessToken); // no dates

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/trips/${trip.id}/overview`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as OverviewBody;

    expect(body.stays.ok).toBe(false);
    expect(body.stays.code).toBe('TRIP_DATES_REQUIRED');

    // Events also require dates — same skip code.
    expect(body.events.ok).toBe(false);
    expect(body.events.code).toBe('TRIP_DATES_REQUIRED');

    // Weather + eateries don't require dates.
    expect(body.weather.ok).toBe(true);
    expect(body.eateries.ok).toBe(true);
    // Itinerary hasn't been generated for this trip — empty list is
    // still ok:true (empty data, not a failure).
    expect(body.itinerary.ok).toBe(true);
    expect(body.itinerary.data!.days).toHaveLength(0);
  });

  it('weather provider failure → weather section ok:false, other sections unaffected', async () => {
    if (!dbReachable) return;
    weatherStub.shouldFail = true;
    const { accessToken } = await registerUser('weather-fail');
    const trip = await createTrip(accessToken, {
      startsOn: '2026-12-10',
      endsOn: '2026-12-12',
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/trips/${trip.id}/overview`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as OverviewBody;

    expect(body.weather.ok).toBe(false);
    // The stub throws a plain Error; coerceCode falls back to a
    // generic marker.
    expect(body.weather.code).toBeDefined();

    expect(body.stays.ok).toBe(true);
    expect(body.eateries.ok).toBe(true);
    expect(body.events.ok).toBe(true);
  });

  it('non-owner → 404 TRIP_NOT_FOUND, whole response fails (not partial)', async () => {
    if (!dbReachable) return;
    const alice = await registerUser('alice');
    const bob = await registerUser('bob');
    const trip = await createTrip(alice.accessToken, {
      startsOn: '2026-12-15',
      endsOn: '2026-12-18',
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/trips/${trip.id}/overview`,
      headers: { authorization: `Bearer ${bob.accessToken}` },
    });
    // Owner gate fails before any sub-fetch — this isn't a graceful
    // partial response, it's an auth-style 404.
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).code).toBe('TRIP_NOT_FOUND');
  });

  it('unauthenticated → 401 UNAUTHENTICATED', async () => {
    if (!dbReachable) return;
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/trips/whatever/overview',
    });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).code).toBe('UNAUTHENTICATED');
  });
});
