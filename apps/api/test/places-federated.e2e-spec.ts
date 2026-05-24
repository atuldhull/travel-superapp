/**
 * Integration tests for the federated Places search ([IV.18.4.1]).
 *
 * Same structural shape as weather-cache / stays / food — override
 * the upstream `MockPlaceProvider` class token with a recording +
 * filtering stub so the decorator + Redis cache stay in the chain
 * but upstream invocations are countable.
 *
 * Installed by prompt [IV.18.4.1].
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
  FederatedPlaceSearchInput,
  PlaceProvider,
} from '../src/modules/places/application/ports/place-provider';
import type { FederatedPlaceResult } from '../src/modules/places/domain/federated-place-result.entity';
import { MockPlaceProvider } from '../src/modules/places/infrastructure/mock-place-provider';
import { uniqueEmail } from './factories';

const TEST_PREFIX = 'places-fed-e2e';

class RecordingPlaceProvider implements PlaceProvider {
  public calls: FederatedPlaceSearchInput[] = [];

  reset(): void {
    this.calls = [];
  }

  async search(input: FederatedPlaceSearchInput): Promise<readonly FederatedPlaceResult[]> {
    this.calls.push(input);
    const all: FederatedPlaceResult[] = [
      {
        externalId: 'mock:museum',
        provider: 'mock',
        name: 'Museum',
        category: 'museum',
        address: null,
        countryCode: null,
        lat: input.lat,
        lng: input.lng,
        distanceMeters: 200,
      },
      {
        externalId: 'mock:park',
        provider: 'mock',
        name: 'Park',
        category: 'park',
        address: null,
        countryCode: null,
        lat: input.lat,
        lng: input.lng,
        distanceMeters: 1_200,
      },
    ];
    return all.filter((r) => (input.category ? r.category === input.category.toLowerCase() : true));
  }
}

describe('Places federated search (integration, requires Docker Postgres + Redis)', () => {
  let moduleRef: TestingModule;
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let stub: RecordingPlaceProvider;
  let dbReachable = true;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MockPlaceProvider)
      .useValue(new RecordingPlaceProvider())
      .compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.useGlobalFilters(new AllExceptionFilter(), new DomainExceptionFilter());
    app.setGlobalPrefix('api/v1', { exclude: ['health', 'health/(.*)'] });
    await app.register(fastifyCookie);
    try {
      await app.init();
      await app.getHttpAdapter().getInstance().ready();
      prisma = moduleRef.get(PrismaService);
      stub = moduleRef.get<RecordingPlaceProvider>(MockPlaceProvider);
      await prisma.$queryRaw`SELECT 1`;

      // Wipe travel-test:places-search:* so prior-run entries don't
      // mask upstream calls this suite expects to observe.
      const flush = new Redis(process.env['REDIS_URL']!, {
        lazyConnect: false,
        maxRetriesPerRequest: 2,
      });
      try {
        const stream = flush.scanStream({
          match: `travel-${process.env['NODE_ENV']}:places-search:*`,
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
      console.warn(`places-federated test: infra not reachable (${message}). Skipping.`);
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
      category: string;
    }> = {},
  ): Record<string, unknown> {
    return {
      center: { lat: 6.789, lng: 132.456 },
      radiusKm: 5,
      ...overrides,
    };
  }

  it('POST /places/federated-search without a bearer → 401 UNAUTHENTICATED', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/places/federated-search',
      payload: basePayload(),
    });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).code).toBe('UNAUTHENTICATED');
  });

  it('happy path → 200 with provider results + provider input echoed', async () => {
    const tok = await token('ok');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/places/federated-search',
      headers: { authorization: `Bearer ${tok}` },
      payload: basePayload({ center: { lat: 6.111, lng: 132.222 } }),
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { results: FederatedPlaceResult[] };
    expect(body.results.length).toBe(2);
    expect(body.results.every((r) => r.provider === 'mock')).toBe(true);
    // Every external result has an externalId — we don't issue internal cuids.
    expect(body.results.every((r) => typeof r.externalId === 'string')).toBe(true);

    expect(stub.calls).toHaveLength(1);
    expect(stub.calls[0]!.lat).toBeCloseTo(6.111, 4);
    expect(stub.calls[0]!.lng).toBeCloseTo(132.222, 4);
    expect(stub.calls[0]!.radiusKm).toBe(5);
    expect(stub.calls[0]!.category).toBeUndefined();
  });

  it('category filter flows through + narrows results', async () => {
    const tok = await token('category');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/places/federated-search',
      headers: { authorization: `Bearer ${tok}` },
      payload: basePayload({
        center: { lat: 7.111, lng: 133.222 },
        category: 'museum',
      }),
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { results: FederatedPlaceResult[] };
    expect(body.results.every((r) => r.category === 'museum')).toBe(true);
    expect(stub.calls[0]!.category).toBe('museum');
  });

  it('radius > 50km → 422 INVALID_RADIUS', async () => {
    const tok = await token('bad-radius');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/places/federated-search',
      headers: { authorization: `Bearer ${tok}` },
      payload: basePayload({ radiusKm: 75 }),
    });
    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body).code).toBe('INVALID_RADIUS');
  });

  it('lat out of range → 422 VALIDATION_FAILED (Zod blocks first)', async () => {
    const tok = await token('bad-lat');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/places/federated-search',
      headers: { authorization: `Bearer ${tok}` },
      payload: basePayload({ center: { lat: 999, lng: 0 } }),
    });
    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body).code).toBe('VALIDATION_FAILED');
  });

  it('cache hit: identical search → upstream called once across 3 HTTP requests', async () => {
    const tok = await token('cache-hit');
    const payload = basePayload({ center: { lat: 8.111, lng: 134.222 } });
    for (const _ of [1, 2, 3]) {
      void _;
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/places/federated-search',
        headers: { authorization: `Bearer ${tok}` },
        payload,
      });
      expect(res.statusCode).toBe(200);
    }
    expect(stub.calls).toHaveLength(1);
  });

  it('cache miss on different category → separate upstream call', async () => {
    const tok = await token('cache-category');
    await app.inject({
      method: 'POST',
      url: '/api/v1/places/federated-search',
      headers: { authorization: `Bearer ${tok}` },
      payload: basePayload({
        center: { lat: 9.111, lng: 135.222 },
        category: 'museum',
      }),
    });
    await app.inject({
      method: 'POST',
      url: '/api/v1/places/federated-search',
      headers: { authorization: `Bearer ${tok}` },
      payload: basePayload({
        center: { lat: 9.111, lng: 135.222 },
        category: 'park',
      }),
    });
    expect(stub.calls).toHaveLength(2);
  });
});
