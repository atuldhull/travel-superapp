/**
 * Integration tests for the admin force-purge endpoint
 * ([IV.18.18.2]).
 *
 *   POST /api/v1/admin/account-purge
 *
 * Wraps the same `runTick()` method the daily setInterval calls
 * (`AccountPurgeScheduler`). Useful when ops wants to apply a
 * retention-rule change immediately or confirm cron health
 * end-to-end after a deploy.
 *
 * Installed by prompt [IV.18.18.2].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';
import { uniqueEmail } from './factories';

const TEST_PREFIX = 'admin-purge-e2e';

describe('POST /admin/account-purge (integration, requires Docker Postgres)', () => {
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
      console.warn(`admin-purge test: DB not reachable (${message}). Skipping.`);
      dbReachable = false;
    }
  });

  afterEach(async () => {
    if (!dbReachable) return;
    await prisma.user.deleteMany({
      where: { displayName: { startsWith: TEST_PREFIX } },
    });
  });

  afterAll(async () => {
    if (dbReachable) await app.close();
    await moduleRef.close();
  });

  async function registerUser(suffix: string): Promise<{
    userId: string;
    accessToken: string;
    email: string;
    password: string;
  }> {
    const email = uniqueEmail(`${TEST_PREFIX}-${suffix}`);
    const password = 'correct-horse-battery-staple';
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email, password, displayName: `${TEST_PREFIX}-${suffix}` },
    });
    expect(res.statusCode).toBe(201);
    return {
      ...(JSON.parse(res.body) as { userId: string; accessToken: string }),
      email,
      password,
    };
  }

  async function loginAsAdmin(suffix: string): Promise<string> {
    const reg = await registerUser(suffix);
    await prisma.user.update({ where: { id: reg.userId }, data: { role: 'admin' } });
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: reg.email, password: reg.password },
    });
    expect(login.statusCode).toBe(200);
    return (JSON.parse(login.body) as { accessToken: string }).accessToken;
  }

  it('without bearer → 401', async () => {
    if (!dbReachable) return;
    const res = await app.inject({ method: 'POST', url: '/api/v1/admin/account-purge' });
    expect(res.statusCode).toBe(401);
  });

  it('non-admin → 403', async () => {
    if (!dbReachable) return;
    const { accessToken } = await registerUser('non-admin');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/account-purge',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('admin → 200 { ok: true } and sweeps eligible soft-deleted rows', async () => {
    if (!dbReachable) return;
    const adminToken = await loginAsAdmin('purge-admin');
    // Seed a user, soft-delete + backdate to 8 days ago so it's
    // past the retention window.
    const target = await registerUser('eligible');
    await prisma.user.update({
      where: { id: target.userId },
      data: { deletedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/account-purge',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ ok: true });

    // Eligible row gone.
    const u = await prisma.user.findUnique({ where: { id: target.userId } });
    expect(u).toBeNull();
  });

  it('idempotent: a second admin call still returns ok', async () => {
    if (!dbReachable) return;
    const adminToken = await loginAsAdmin('idempotent');
    const first = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/account-purge',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(first.statusCode).toBe(200);
    const second = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/account-purge',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(second.statusCode).toBe(200);
    expect(JSON.parse(second.body)).toEqual({ ok: true });
  });
});
