/**
 * V.UX.35 — integration tests for SOS cancel + local-emergency lookup.
 *
 *   1. Trigger SOS → POST /sos/:id/cancel returns 200 + resolutionNote
 *      = 'cancelled_by_user'.
 *   2. Cross-user cancel → 404 SOS_NOT_FOUND.
 *   3. Re-cancel after resolved → 404 SOS_NOT_FOUND.
 *   4. GET /safety/emergency-numbers/US returns 911.
 *   5. Lookup is @Public — no bearer needed.
 *   6. Unknown country → 404 EMERGENCY_INFO_NOT_FOUND.
 *
 * Installed by prompt [V.UX.35].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';

const TEST_PREFIX = 'sos-cancel-e2e';

interface RegisterRes {
  userId: string;
  accessToken: string;
}

describe('V.UX.35 SOS cancel + emergency numbers (integration, requires Docker Postgres)', () => {
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
      // eslint-disable-next-line no-console
      console.warn(
        `sos-cancel: DB not reachable (${err instanceof Error ? err.message : String(err)}). Skipping.`,
      );
      dbReachable = false;
    }
  });

  afterEach(async () => {
    if (!dbReachable) return;
    await prisma.sosEvent.deleteMany({
      where: { user: { displayName: { startsWith: TEST_PREFIX } } },
    });
    await prisma.user.deleteMany({ where: { displayName: { startsWith: TEST_PREFIX } } });
  });

  afterAll(async () => {
    if (dbReachable) await app.close();
    await moduleRef.close();
  });

  async function registerUser(suffix: string): Promise<RegisterRes> {
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
    return JSON.parse(res.body) as RegisterRes;
  }

  async function trigger(token: string): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/safety/sos',
      headers: { authorization: `Bearer ${token}` },
      payload: { trigger: 'panic', center: { lat: 12.97, lng: 77.59 } },
    });
    expect(res.statusCode).toBe(201);
    return (JSON.parse(res.body) as { id: string }).id;
  }

  it('Cancel happy path → 200 + cancelled_by_user note', async () => {
    if (!dbReachable) return;
    const u = await registerUser('cancel');
    const id = await trigger(u.accessToken);
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/safety/sos/${id}/cancel`,
      headers: { authorization: `Bearer ${u.accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { resolutionNote: string };
    expect(body.resolutionNote).toBe('cancelled_by_user');
  });

  it('Cross-user cancel → 404 SOS_NOT_FOUND', async () => {
    if (!dbReachable) return;
    const owner = await registerUser('owner');
    const stranger = await registerUser('stranger');
    const id = await trigger(owner.accessToken);
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/safety/sos/${id}/cancel`,
      headers: { authorization: `Bearer ${stranger.accessToken}` },
    });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).code).toBe('SOS_NOT_FOUND');
  });

  it('Re-cancel after resolved → 404 SOS_NOT_FOUND', async () => {
    if (!dbReachable) return;
    const u = await registerUser('replay');
    const id = await trigger(u.accessToken);
    const first = await app.inject({
      method: 'POST',
      url: `/api/v1/safety/sos/${id}/cancel`,
      headers: { authorization: `Bearer ${u.accessToken}` },
    });
    expect(first.statusCode).toBe(200);
    const second = await app.inject({
      method: 'POST',
      url: `/api/v1/safety/sos/${id}/cancel`,
      headers: { authorization: `Bearer ${u.accessToken}` },
    });
    expect(second.statusCode).toBe(404);
  });

  it('Public emergency lookup: US → 911', async () => {
    // The endpoint itself is a pure in-memory lookup, but the test
    // app still needs to have BOOTED — a down Postgres makes
    // `app.init()` unhealthy and every request 500s. Guard like the
    // SOS tests above so an infra outage SKIPS rather than false-fails.
    if (!dbReachable) return;
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/safety/emergency-numbers/US',
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { universal: string | null; police: string };
    expect(body.universal).toBe('911');
    expect(body.police).toBe('911');
  });

  it('Public emergency lookup: case-insensitive (gb → GB)', async () => {
    if (!dbReachable) return;
    const res = await app.inject({ method: 'GET', url: '/api/v1/safety/emergency-numbers/gb' });
    expect(res.statusCode).toBe(200);
    expect((JSON.parse(res.body) as { countryCode: string }).countryCode).toBe('GB');
  });

  it('Unknown country → 404 EMERGENCY_INFO_NOT_FOUND', async () => {
    if (!dbReachable) return;
    const res = await app.inject({ method: 'GET', url: '/api/v1/safety/emergency-numbers/ZZ' });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).code).toBe('EMERGENCY_INFO_NOT_FOUND');
  });
});
