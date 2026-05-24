/**
 * Integration tests for the Food module ([IV.18.7.1]).
 *
 * Same structural shape as Weather + Stays — override the upstream
 * `MockEateryProvider` class token with a recorder so the decorator
 * + Redis cache stay in the chain but upstream invocations are
 * countable.
 *
 * Installed by prompt [IV.18.7.1].
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

const TEST_PREFIX = 'food-e2e';

class RecordingEateryProvider implements EateryProvider {
  public calls: SearchEateriesInput[] = [];

  reset(): void {
    this.calls = [];
  }

  async searchNearby(input: SearchEateriesInput): Promise<readonly EateryListing[]> {
    this.calls.push(input);
    const all: EateryListing[] = [
      {
        externalId: 'mock:ramen',
        provider: 'mock',
        name: 'Neon Ramen',
        cuisineTags: ['japanese', 'ramen'],
        priceTier: 2,
        lat: input.lat,
        lng: input.lng,
        distanceMeters: 250,
      },
      {
        externalId: 'mock:omakase',
        provider: 'mock',
        name: 'Omakase Hifumi',
        cuisineTags: ['japanese', 'sushi', 'fine-dining'],
        priceTier: 5,
        lat: input.lat,
        lng: input.lng,
        distanceMeters: 1_000,
      },
      {
        externalId: 'mock:tacos',
        provider: 'mock',
        name: 'Taco Cantina',
        cuisineTags: ['mexican'],
        priceTier: 1,
        lat: input.lat,
        lng: input.lng,
        distanceMeters: 1_500,
      },
    ];
    // Apply filters here so tests assert the provider honoured them,
    // not some downstream post-filter.
    return all
      .filter((e) =>
        input.cuisineTag ? e.cuisineTags.includes(input.cuisineTag.toLowerCase()) : true,
      )
      .filter((e) => (input.maxPriceTier !== undefined ? e.priceTier <= input.maxPriceTier : true));
  }
}

describe('Food module (integration, requires Docker Postgres + Redis)', () => {
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
      console.warn(`food test: infra not reachable (${message}). Skipping.`);
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
        email: uniqueEmail(`${TEST_PREFIX}-${suffix}`),
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
      cuisineTag: string;
      maxPriceTier: number;
    }> = {},
  ): Record<string, unknown> {
    return {
      center: { lat: 8.2345, lng: -145.6789 },
      radiusKm: 5,
      ...overrides,
    };
  }

  it('POST /eateries/search without a bearer → 401 UNAUTHENTICATED', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/eateries/search',
      payload: basePayload(),
    });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).code).toBe('UNAUTHENTICATED');
  });

  it('happy path → 200 with listings + provider input echoed', async () => {
    const tok = await token('ok');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/eateries/search',
      headers: { authorization: `Bearer ${tok}` },
      payload: basePayload({ center: { lat: 8.111, lng: -145.222 } }),
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { eateries: EateryListing[] };
    expect(body.eateries.length).toBeGreaterThan(0);

    expect(stub.calls).toHaveLength(1);
    expect(stub.calls[0]!.lat).toBeCloseTo(8.111, 4);
    expect(stub.calls[0]!.lng).toBeCloseTo(-145.222, 4);
    expect(stub.calls[0]!.radiusKm).toBe(5);
    expect(stub.calls[0]!.cuisineTag).toBeUndefined();
    expect(stub.calls[0]!.maxPriceTier).toBeUndefined();
  });

  it('cuisineTag filter flows through to the provider + narrows results', async () => {
    const tok = await token('cuisine');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/eateries/search',
      headers: { authorization: `Bearer ${tok}` },
      payload: basePayload({
        center: { lat: 9.111, lng: -146.222 },
        cuisineTag: 'mexican',
      }),
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { eateries: EateryListing[] };
    expect(body.eateries.every((e) => e.cuisineTags.includes('mexican'))).toBe(true);
    expect(stub.calls[0]!.cuisineTag).toBe('mexican');
  });

  it('maxPriceTier filter caps results to ≤ tier', async () => {
    const tok = await token('price');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/eateries/search',
      headers: { authorization: `Bearer ${tok}` },
      payload: basePayload({
        center: { lat: 10.111, lng: -147.222 },
        maxPriceTier: 2,
      }),
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { eateries: EateryListing[] };
    expect(body.eateries.every((e) => e.priceTier <= 2)).toBe(true);
  });

  it('radius > 25km → 422 INVALID_RADIUS', async () => {
    const tok = await token('bad-radius');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/eateries/search',
      headers: { authorization: `Bearer ${tok}` },
      payload: basePayload({ radiusKm: 50 }),
    });
    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body).code).toBe('INVALID_RADIUS');
  });

  it('maxPriceTier=6 → 422 VALIDATION_FAILED (Zod blocks at DTO)', async () => {
    const tok = await token('bad-tier');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/eateries/search',
      headers: { authorization: `Bearer ${tok}` },
      payload: basePayload({ maxPriceTier: 6 }),
    });
    expect(res.statusCode).toBe(422);
    // Zod's .max(5) trips before the use-case's INVALID_PRICE_TIER.
    expect(JSON.parse(res.body).code).toBe('VALIDATION_FAILED');
  });

  it('cache hit: identical search → upstream called once across 3 HTTP requests', async () => {
    const tok = await token('cache-hit');
    const payload = basePayload({ center: { lat: 11.111, lng: -148.222 } });
    for (const _ of [1, 2, 3]) {
      void _;
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/eateries/search',
        headers: { authorization: `Bearer ${tok}` },
        payload,
      });
      expect(res.statusCode).toBe(200);
    }
    expect(stub.calls).toHaveLength(1);
  });

  it('cache miss: different cuisineTag → separate upstream call', async () => {
    const tok = await token('cache-cuisine');
    await app.inject({
      method: 'POST',
      url: '/api/v1/eateries/search',
      headers: { authorization: `Bearer ${tok}` },
      payload: basePayload({
        center: { lat: 12.111, lng: -149.222 },
        cuisineTag: 'japanese',
      }),
    });
    await app.inject({
      method: 'POST',
      url: '/api/v1/eateries/search',
      headers: { authorization: `Bearer ${tok}` },
      payload: basePayload({
        center: { lat: 12.111, lng: -149.222 },
        cuisineTag: 'mexican',
      }),
    });
    expect(stub.calls).toHaveLength(2);
  });
});
