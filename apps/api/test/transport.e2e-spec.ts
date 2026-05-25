/**
 * Integration tests for the Transport module ([IV.18.10.1]).
 *
 * Drives the real `MockRoutingProvider` — its haversine-based
 * deterministic shape makes assertions exact. Cache namespace
 * (`routing`) gets SCAN-DELed on suite start so prior-run entries
 * don't mask upstream invocations.
 *
 * Installed by prompt [IV.18.10.1].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import Redis from 'ioredis';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';
import type { RouteLeg } from '../src/modules/transport/domain/route-leg.entity';
import { uniqueEmail } from './factories';

const TEST_PREFIX = 'transport-e2e';

describe('Transport module (integration, requires Docker Postgres + Redis)', () => {
  let moduleRef: TestingModule;
  let app: NestFastifyApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.useGlobalFilters(new AllExceptionFilter(), new DomainExceptionFilter());
    app.setGlobalPrefix('api/v1', { exclude: ['health', 'health/(.*)'] });
    await app.register(fastifyCookie);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    prisma = moduleRef.get(PrismaService);
    await prisma.$queryRaw`SELECT 1`;

    const flush = new Redis(process.env['REDIS_URL']!, {
      lazyConnect: false,
      maxRetriesPerRequest: 2,
    });
    try {
      const stream = flush.scanStream({
        match: `travel-${process.env['NODE_ENV']}:routing:*`,
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
    await prisma.user.deleteMany({
      where: { displayName: { startsWith: TEST_PREFIX } },
    });
  });

  afterAll(async () => {
    await app.close();
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

  it('POST /transport/routes without a bearer → 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/transport/routes',
      payload: {
        origin: { lat: 40.7, lng: -74.0 },
        destination: { lat: 40.75, lng: -73.99 },
      },
    });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).code).toBe('UNAUTHENTICATED');
  });

  it('happy path — 5km trip returns all 7 modes (walk still in range)', async () => {
    const tok = await token('ok');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/transport/routes',
      headers: { authorization: `Bearer ${tok}` },
      payload: {
        // ~4.7 km apart.
        origin: { lat: 40.7, lng: -74.0 },
        destination: { lat: 40.74, lng: -74.01 },
      },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { routes: RouteLeg[] };
    // All 7 modes available at ≤ 20 km.
    expect(body.routes.map((r) => r.mode).sort()).toEqual(
      ['bicycle', 'car', 'public_transit', 'rideshare', 'taxi', 'two_wheeler', 'walk'].sort(),
    );
    // Walk is the slowest + free.
    const walk = body.routes.find((r) => r.mode === 'walk')!;
    const car = body.routes.find((r) => r.mode === 'car')!;
    expect(walk.estimatedCostUsd).toBeNull();
    expect(walk.durationSeconds).toBeGreaterThan(car.durationSeconds);
    // Rideshare has a higher per-km + base than car.
    const ride = body.routes.find((r) => r.mode === 'rideshare')!;
    expect(ride.estimatedCostUsd).not.toBeNull();
    expect(ride.estimatedCostUsd!).toBeGreaterThan(car.estimatedCostUsd!);
  });

  it('long trip (50 km) omits walk (>20km cap) but keeps car/taxi/transit', async () => {
    const tok = await token('long');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/transport/routes',
      headers: { authorization: `Bearer ${tok}` },
      payload: {
        // ~55 km apart (roughly NYC → White Plains).
        origin: { lat: 40.7, lng: -74.0 },
        destination: { lat: 41.03, lng: -73.77 },
      },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { routes: RouteLeg[] };
    const modes = body.routes.map((r) => r.mode);
    expect(modes).not.toContain('walk');
    expect(modes).toContain('car');
    expect(modes).toContain('rideshare');
    expect(modes).toContain('public_transit'); // still under the 100km transit cap
  });

  it('modes filter narrows the response', async () => {
    const tok = await token('filter');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/transport/routes',
      headers: { authorization: `Bearer ${tok}` },
      payload: {
        origin: { lat: 40.7, lng: -74.0 },
        destination: { lat: 40.72, lng: -74.0 },
        modes: ['walk', 'bicycle'],
      },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { routes: RouteLeg[] };
    expect(body.routes.map((r) => r.mode).sort()).toEqual(['bicycle', 'walk']);
  });

  it('origin === destination → 422 SAME_ORIGIN_DESTINATION', async () => {
    const tok = await token('same');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/transport/routes',
      headers: { authorization: `Bearer ${tok}` },
      payload: {
        origin: { lat: 40.7, lng: -74.0 },
        destination: { lat: 40.7, lng: -74.0 },
      },
    });
    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body).code).toBe('SAME_ORIGIN_DESTINATION');
  });

  it('straight-line > 500km → 422 ROUTE_TOO_LONG', async () => {
    const tok = await token('too-long');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/transport/routes',
      headers: { authorization: `Bearer ${tok}` },
      payload: {
        // NYC → Chicago ~1,150 km.
        origin: { lat: 40.7, lng: -74.0 },
        destination: { lat: 41.88, lng: -87.63 },
      },
    });
    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body).code).toBe('ROUTE_TOO_LONG');
  });

  it('invalid lat → 422 VALIDATION_FAILED (Zod blocks first)', async () => {
    const tok = await token('bad-lat');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/transport/routes',
      headers: { authorization: `Bearer ${tok}` },
      payload: {
        origin: { lat: 999, lng: 0 },
        destination: { lat: 40.7, lng: -74.0 },
      },
    });
    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body).code).toBe('VALIDATION_FAILED');
  });

  it('unknown mode → 422 VALIDATION_FAILED (Zod enum)', async () => {
    const tok = await token('bad-mode');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/transport/routes',
      headers: { authorization: `Bearer ${tok}` },
      payload: {
        origin: { lat: 40.7, lng: -74.0 },
        destination: { lat: 40.72, lng: -74.0 },
        modes: ['teleport'],
      },
    });
    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body).code).toBe('VALIDATION_FAILED');
  });
});
