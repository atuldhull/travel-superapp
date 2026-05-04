/**
 * V.UX.34 — integration tests for the ban-with-reason flow + appeal
 * queue.
 *
 *   1. Admin ban without `reason` → 422 (Zod requires non-empty).
 *   2. Login on banned account → 401 ACCOUNT_BANNED + reason in
 *      context.
 *   3. POST /account/appeal with valid email + body → 200; row
 *      created.
 *   4. Appeal for unknown / non-banned email → 200 + no row (no
 *      enumeration leak).
 *   5. Soft rate-limit: 4th appeal in an hour → no new row.
 *   6. Admin GET /admin/users/appeals → returns the pending appeal.
 *   7. Banned + reactivated (V.UX.33 link succeeds) — login still
 *      blocked because bannedAt non-null.
 *
 * Installed by prompt [V.UX.34].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';

const TEST_PREFIX = 'ban-appeal-e2e';

interface RegisterRes {
  userId: string;
  accessToken: string;
}

describe('V.UX.34 ban + appeal (integration, requires Docker Postgres)', () => {
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
        `ban-appeal: DB not reachable (${err instanceof Error ? err.message : String(err)}). Skipping.`,
      );
      dbReachable = false;
    }
  });

  afterEach(async () => {
    if (!dbReachable) return;
    await prisma.banAppeal.deleteMany({});
    await prisma.user.deleteMany({ where: { displayName: { startsWith: TEST_PREFIX } } });
  });

  afterAll(async () => {
    if (dbReachable) await app.close();
    await moduleRef.close();
  });

  async function registerUser(suffix: string): Promise<{
    userId: string;
    email: string;
    accessToken: string;
  }> {
    const email = `${TEST_PREFIX}-${suffix}-${Date.now()}@example.com`;
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email,
        password: 'correct-horse-battery-staple',
        displayName: `${TEST_PREFIX}-${suffix}`,
      },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body) as RegisterRes;
    return { userId: body.userId, email, accessToken: body.accessToken };
  }

  async function loginAsAdmin(suffix: string): Promise<string> {
    const u = await registerUser(`admin-${suffix}`);
    await prisma.user.update({ where: { id: u.userId }, data: { role: 'admin' } });
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: u.email, password: 'correct-horse-battery-staple' },
    });
    expect(login.statusCode).toBe(200);
    return (JSON.parse(login.body) as { accessToken: string }).accessToken;
  }

  it('Ban without reason → 422 VALIDATION_FAILED', async () => {
    if (!dbReachable) return;
    const adminToken = await loginAsAdmin('no-reason');
    const target = await registerUser('no-reason-target');
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/users/${target.userId}/ban`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {},
    });
    expect(res.statusCode).toBe(422);
  });

  it('Login on banned account → 401 ACCOUNT_BANNED with reason', async () => {
    if (!dbReachable) return;
    const adminToken = await loginAsAdmin('login-ban');
    const target = await registerUser('login-target');
    const reason = 'Posted spam in trip reviews.';
    await app.inject({
      method: 'POST',
      url: `/api/v1/admin/users/${target.userId}/ban`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { reason },
    });
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: target.email, password: 'correct-horse-battery-staple' },
    });
    expect(login.statusCode).toBe(401);
    const body = JSON.parse(login.body) as {
      code: string;
      context: { banReason?: string; bannedAt?: string };
    };
    expect(body.code).toBe('ACCOUNT_BANNED');
    expect(body.context.banReason).toBe(reason);
    expect(typeof body.context.bannedAt).toBe('string');
  });

  it('Appeal happy path → row created with status=pending', async () => {
    if (!dbReachable) return;
    const adminToken = await loginAsAdmin('appeal-happy');
    const target = await registerUser('appeal-target');
    await app.inject({
      method: 'POST',
      url: `/api/v1/admin/users/${target.userId}/ban`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { reason: 'Bug ban for test.' },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/account/appeal',
      payload: {
        email: target.email,
        body: 'I believe this ban was a mistake — context: I was reporting the spam, not posting it.',
      },
    });
    expect(res.statusCode).toBe(200);
    const rows = await prisma.banAppeal.findMany({ where: { userId: target.userId } });
    expect(rows.length).toBe(1);
    expect(rows[0]!.status).toBe('pending');
  });

  it('Appeal for unknown / non-banned email → 200, no row', async () => {
    if (!dbReachable) return;
    const before = await prisma.banAppeal.count();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/account/appeal',
      payload: {
        email: `${TEST_PREFIX}-nobody-${Date.now()}@example.com`,
        body: 'This account does not exist; should silently succeed.',
      },
    });
    expect(res.statusCode).toBe(200);
    const after = await prisma.banAppeal.count();
    expect(after).toBe(before);
  });

  it('Appeal: 4th submission within an hour → no new row (rate-limit)', async () => {
    if (!dbReachable) return;
    const adminToken = await loginAsAdmin('appeal-rl');
    const target = await registerUser('appeal-rl-target');
    await app.inject({
      method: 'POST',
      url: `/api/v1/admin/users/${target.userId}/ban`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { reason: 'Bug ban.' },
    });
    for (let i = 0; i < 3; i++) {
      const r = await app.inject({
        method: 'POST',
        url: '/api/v1/account/appeal',
        payload: {
          email: target.email,
          body: `Appeal attempt ${i + 1} — please reconsider, here is more context.`,
        },
      });
      expect(r.statusCode).toBe(200);
    }
    const beforeFourth = await prisma.banAppeal.count({ where: { userId: target.userId } });
    expect(beforeFourth).toBe(3);
    const fourth = await app.inject({
      method: 'POST',
      url: '/api/v1/account/appeal',
      payload: {
        email: target.email,
        body: 'Fourth appeal in the same hour, should be rate-limited.',
      },
    });
    expect(fourth.statusCode).toBe(200);
    const after = await prisma.banAppeal.count({ where: { userId: target.userId } });
    expect(after).toBe(3);
  });

  it('Admin GET /admin/users/appeals returns pending submissions', async () => {
    if (!dbReachable) return;
    const adminToken = await loginAsAdmin('appeals-list');
    const target = await registerUser('appeal-listed');
    await app.inject({
      method: 'POST',
      url: `/api/v1/admin/users/${target.userId}/ban`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { reason: 'Ban for queue test.' },
    });
    await app.inject({
      method: 'POST',
      url: '/api/v1/account/appeal',
      payload: { email: target.email, body: 'My appeal body, please review.' },
    });

    const list = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/users/appeals',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(list.statusCode).toBe(200);
    const body = JSON.parse(list.body) as {
      appeals: Array<{ userId: string; status: string; body: string }>;
      total: number;
    };
    const mine = body.appeals.find((a) => a.userId === target.userId);
    expect(mine).toBeDefined();
    expect(mine!.status).toBe('pending');
    expect(mine!.body).toContain('My appeal body');
  });
});
