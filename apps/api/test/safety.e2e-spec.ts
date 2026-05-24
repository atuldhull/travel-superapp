/**
 * Integration tests for the Safety module ([IV.18.11.1]).
 *
 * Real-DB + PostGIS exercise — no provider stubs here because the
 * whole thing is domain-owned (users are the providers).
 *
 * Cross-suite coord contamination avoidance (per
 * memory/feedback_unique_test_coords.md): every report this suite
 * creates uses a unique mid-ocean coord quadrant so concurrent jest
 * workers don't race on ST_DWithin overlaps with other suites.
 *
 * Installed by prompt [IV.18.11.1].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';
import { uniqueEmail } from './factories';

const TEST_PREFIX = 'safety-e2e';
// Suite-local coord. Scam reports can't use `sourceKey` prefixing
// like Places does (ScamReport has no sourceKey column), so cleanup
// is by reporterId (cascaded from User.displayName prefix).
const REMOTE = { lat: 55.1234, lng: -178.9876 };

describe('Safety scam reports (integration, requires Docker Postgres)', () => {
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
      console.warn(`safety test: DB not reachable (${message}). Skipping.`);
      dbReachable = false;
    }
  });

  afterEach(async () => {
    if (!dbReachable) return;
    // User cascade-deletes the reporter's ScamReport rows.
    await prisma.user.deleteMany({
      where: { displayName: { startsWith: TEST_PREFIX } },
    });
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

  function reportBody(
    overrides: Partial<{
      center: { lat: number; lng: number };
      category: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      description: string;
      evidenceUrls: string[];
    }> = {},
  ): Record<string, unknown> {
    return {
      center: REMOTE,
      category: 'fake-taxi',
      severity: 'medium',
      description: 'Driver quoted 3x the meter fare and refused to turn it on.',
      ...overrides,
    };
  }

  it('POST /safety/scam-reports without a bearer → 401', async () => {
    if (!dbReachable) return;
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/safety/scam-reports',
      payload: reportBody(),
    });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).code).toBe('UNAUTHENTICATED');
  });

  it('happy path: create report + find it in nearby search', async () => {
    if (!dbReachable) return;
    const { userId, accessToken } = await registerUser('happy');

    const createdRes = await app.inject({
      method: 'POST',
      url: '/api/v1/safety/scam-reports',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: reportBody({ center: { lat: 55.101, lng: -178.901 } }),
    });
    expect(createdRes.statusCode).toBe(201);
    const created = JSON.parse(createdRes.body) as {
      id: string;
      reporterId: string;
      category: string;
      severity: string;
      description: string;
      verified: boolean;
    };
    expect(created.reporterId).toBe(userId);
    expect(created.category).toBe('fake-taxi');
    expect(created.severity).toBe('medium');
    expect(created.verified).toBe(false); // awaits moderation

    // Nearby search finds it.
    const searchRes = await app.inject({
      method: 'POST',
      url: '/api/v1/safety/scam-reports/search',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        center: { lat: 55.102, lng: -178.902 },
        radiusKm: 2,
      },
    });
    expect(searchRes.statusCode).toBe(200);
    const { reports } = JSON.parse(searchRes.body) as {
      reports: Array<{ id: string; distanceMeters: number }>;
    };
    const found = reports.find((r) => r.id === created.id);
    expect(found).toBeDefined();
    expect(found!.distanceMeters).toBeGreaterThan(0);
    expect(found!.distanceMeters).toBeLessThan(300); // ~180m between the two coords
  });

  it('reports are visible across users (community-safety feature)', async () => {
    if (!dbReachable) return;
    const alice = await registerUser('alice');
    const bob = await registerUser('bob');

    await app.inject({
      method: 'POST',
      url: '/api/v1/safety/scam-reports',
      headers: { authorization: `Bearer ${alice.accessToken}` },
      payload: reportBody({
        center: { lat: 55.201, lng: -178.801 },
        description: 'Alice saw a scam here. Detailed report for Bob to see.',
      }),
    });

    const searchRes = await app.inject({
      method: 'POST',
      url: '/api/v1/safety/scam-reports/search',
      headers: { authorization: `Bearer ${bob.accessToken}` },
      payload: {
        center: { lat: 55.201, lng: -178.801 },
        radiusKm: 1,
      },
    });
    expect(searchRes.statusCode).toBe(200);
    const { reports } = JSON.parse(searchRes.body) as { reports: Array<{ id: string }> };
    expect(reports.length).toBe(1);
  });

  it('minSeverity filter threshold: high excludes low/medium', async () => {
    if (!dbReachable) return;
    const { accessToken } = await registerUser('sev');

    // Seed 4 reports at unique coords so radius=0.5km finds all.
    for (const [sev, offset] of [
      ['low', 0.001],
      ['medium', 0.002],
      ['high', 0.003],
      ['critical', 0.004],
    ] as const) {
      await app.inject({
        method: 'POST',
        url: '/api/v1/safety/scam-reports',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: reportBody({
          center: { lat: 55.3 + offset, lng: -178.7 },
          severity: sev,
          description: `Severity ${sev} test report with enough length.`,
        }),
      });
    }

    const highOnly = await app.inject({
      method: 'POST',
      url: '/api/v1/safety/scam-reports/search',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        center: { lat: 55.3025, lng: -178.7 },
        radiusKm: 2,
        minSeverity: 'high',
      },
    });
    expect(highOnly.statusCode).toBe(200);
    const body = JSON.parse(highOnly.body) as {
      reports: Array<{ severity: string }>;
    };
    expect(body.reports.every((r) => ['high', 'critical'].includes(r.severity))).toBe(true);
    expect(body.reports.length).toBe(2);
  });

  it('category filter narrows to exact match', async () => {
    if (!dbReachable) return;
    const { accessToken } = await registerUser('cat');

    await app.inject({
      method: 'POST',
      url: '/api/v1/safety/scam-reports',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: reportBody({
        center: { lat: 55.4, lng: -178.6 },
        category: 'pickpocket',
      }),
    });
    await app.inject({
      method: 'POST',
      url: '/api/v1/safety/scam-reports',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: reportBody({
        center: { lat: 55.4005, lng: -178.6005 },
        category: 'fake-taxi',
      }),
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/safety/scam-reports/search',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        center: { lat: 55.4, lng: -178.6 },
        radiusKm: 1,
        category: 'pickpocket',
      },
    });
    const body = JSON.parse(res.body) as { reports: Array<{ category: string }> };
    expect(body.reports.every((r) => r.category === 'pickpocket')).toBe(true);
    expect(body.reports.length).toBe(1);
  });

  it('description shorter than 10 chars → 422 VALIDATION_FAILED', async () => {
    if (!dbReachable) return;
    const { accessToken } = await registerUser('short');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/safety/scam-reports',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: reportBody({ description: 'too short' }),
    });
    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body).code).toBe('VALIDATION_FAILED');
  });

  it('search radius > 50km → 422 INVALID_RADIUS', async () => {
    if (!dbReachable) return;
    const { accessToken } = await registerUser('big-r');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/safety/scam-reports/search',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { center: REMOTE, radiusKm: 100 },
    });
    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body).code).toBe('INVALID_RADIUS');
  });

  it('invalid severity → 422 VALIDATION_FAILED (Zod enum)', async () => {
    if (!dbReachable) return;
    const { accessToken } = await registerUser('bad-sev');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/safety/scam-reports',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: reportBody({ severity: 'catastrophic' as 'low' }),
    });
    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body).code).toBe('VALIDATION_FAILED');
  });
});
