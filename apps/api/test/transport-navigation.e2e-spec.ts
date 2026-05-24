/**
 * Integration tests for the live-navigation surface
 * (`POST /transport/navigation`).
 *
 * `NODE_ENV === 'test'`, so `CompositeNavigationProvider` uses the
 * deterministic `MockNavigationProvider` and `CompositeTrafficProvider`
 * uses `MockTrafficProvider` — no network, exact assertions. The mock
 * intentionally injects a closure on the FASTEST route so we can
 * assert the "blockage → recommend an alternative" behaviour.
 *
 * Installed for the live-navigation feature.
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';
import type { NavRouteSet } from '../src/modules/transport/domain/nav-route.entity';
import { uniqueEmail } from './factories';

const TEST_PREFIX = 'transport-nav-e2e';

describe('Transport navigation (integration, requires Docker Postgres + Redis)', () => {
  let moduleRef: TestingModule;
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let dbReachable = true;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.useGlobalFilters(new AllExceptionFilter(), new DomainExceptionFilter());
    app.setGlobalPrefix('api/v1', { exclude: ['health', 'health/(.*)'] });
    await app.register(fastifyCookie);
    try {
      await app.init();
      await app.getHttpAdapter().getInstance().ready();
      prisma = moduleRef.get(PrismaService);
      await prisma.$queryRaw`SELECT 1`;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // eslint-disable-next-line no-console
      console.warn(`transport-nav test: infra not reachable (${message}). Skipping.`);
      dbReachable = false;
    }
  });

  afterEach(async () => {
    if (dbReachable) {
      await prisma.user.deleteMany({ where: { displayName: { startsWith: TEST_PREFIX } } });
    }
  });

  afterAll(async () => {
    if (dbReachable) await app.close();
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

  it('without a bearer → 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/transport/navigation',
      payload: { origin: { lat: 40.7, lng: -74.0 }, destination: { lat: 40.74, lng: -74.01 } },
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns 3 flavours; fastest has a closure → recommended is a clear alternative', async () => {
    const tok = await token('ok');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/transport/navigation',
      headers: { authorization: `Bearer ${tok}` },
      payload: { origin: { lat: 40.7, lng: -74.0 }, destination: { lat: 40.74, lng: -74.01 } },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as NavRouteSet;

    expect(body.routeSource).toBe('mock');
    expect([...body.routes].map((r) => r.flavor).sort()).toEqual(
      ['avoid_traffic', 'fastest', 'scenic'].sort(),
    );

    const fastest = body.routes.find((r) => r.flavor === 'fastest')!;
    const scenic = body.routes.find((r) => r.flavor === 'scenic')!;
    expect(fastest.geometry.length).toBeGreaterThan(2);
    // Mock carves a closure into the fastest route.
    expect(fastest.trafficSegments.some((s) => s.level === 'blocked')).toBe(true);
    expect(fastest.advisories.some((a) => a.kind === 'blockage')).toBe(true);
    expect(fastest.advisories.some((a) => a.kind === 'reroute')).toBe(true);
    // Scenic is the longer / more-adventurous line.
    expect(scenic.distanceMeters).toBeGreaterThan(fastest.distanceMeters);
    // Traffic-aware ETA never beats the free-flow duration.
    for (const r of body.routes) {
      expect(r.durationInTrafficSeconds).toBeGreaterThanOrEqual(r.durationSeconds);
      expect(r.trafficSource).toBe('mock');
    }
    // Recommendation must avoid the blocked fastest route.
    const rec = body.routes.find((r) => r.id === body.recommendedRouteId)!;
    expect(rec).toBeDefined();
    expect(rec.id).not.toBe(fastest.id);
    expect(rec.trafficSegments.some((s) => s.level === 'blocked')).toBe(false);
  });

  it('waypoints lengthen the drawn geometry', async () => {
    const tok = await token('via');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/transport/navigation',
      headers: { authorization: `Bearer ${tok}` },
      payload: {
        origin: { lat: 40.7, lng: -74.0 },
        destination: { lat: 40.74, lng: -74.01 },
        waypoints: [{ lat: 40.72, lng: -74.02 }],
      },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as NavRouteSet;
    const fastest = body.routes.find((r) => r.flavor === 'fastest')!;
    // 2 hops → roughly double the single-hop point count (>15).
    expect(fastest.geometry.length).toBeGreaterThan(15);
  });

  it('origin === destination with no waypoints → 422 SAME_ORIGIN_DESTINATION', async () => {
    const tok = await token('same');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/transport/navigation',
      headers: { authorization: `Bearer ${tok}` },
      payload: { origin: { lat: 40.7, lng: -74.0 }, destination: { lat: 40.7, lng: -74.0 } },
    });
    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body).code).toBe('SAME_ORIGIN_DESTINATION');
  });

  it('invalid lat → 422 VALIDATION_FAILED (Zod blocks first)', async () => {
    const tok = await token('bad-lat');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/transport/navigation',
      headers: { authorization: `Bearer ${tok}` },
      payload: { origin: { lat: 999, lng: 0 }, destination: { lat: 40.7, lng: -74.0 } },
    });
    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body).code).toBe('VALIDATION_FAILED');
  });

  it('> 8 waypoints → 422 VALIDATION_FAILED (Zod max)', async () => {
    const tok = await token('too-many');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/transport/navigation',
      headers: { authorization: `Bearer ${tok}` },
      payload: {
        origin: { lat: 40.7, lng: -74.0 },
        destination: { lat: 40.74, lng: -74.01 },
        waypoints: Array.from({ length: 9 }, (_, i) => ({ lat: 40.71 + i * 0.001, lng: -74.0 })),
      },
    });
    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body).code).toBe('VALIDATION_FAILED');
  });
});
