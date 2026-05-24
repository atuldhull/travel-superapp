/**
 * V.UX.37 — compliance dashboard integration tests.
 *
 *   GET /api/v1/compliance/retention
 *   GET /api/v1/compliance/takedowns
 *
 * Verifies:
 *   1. Auth gate: anon → 401.
 *   2. Role gate: regular `user` → 403; `compliance` ✓; `admin` ✓.
 *   3. Retention stats include the seeded soft-deleted user under
 *      `users.softDeleted`.
 *   4. Takedown list includes a seeded `delete_media` audit row but
 *      excludes the seeded `ban` audit row (ban is admin moderation,
 *      not user-content takedown).
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';
import { uniqueSuffix } from './factories';

const TEST_PREFIX = 'compliance-e2e';

interface RetentionResp {
  retentionDays: number;
  users: { active: number; softDeleted: number; scheduledForPurge: number; banned: number };
  computedAt: string;
}

interface TakedownsResp {
  rows: Array<{ action: string; targetType: string; targetId: string }>;
  total: number;
}

describe('V.UX.37 — Compliance dashboard (integration, requires Docker Postgres)', () => {
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
      console.warn(`compliance test: DB not reachable (${message}). Skipping.`);
      dbReachable = false;
    }
  });

  afterEach(async () => {
    if (!dbReachable) return;
    const ourUsers = await prisma.user.findMany({
      where: { displayName: { startsWith: TEST_PREFIX } },
      select: { id: true },
    });
    const ids = ourUsers.map((u) => u.id);
    if (ids.length > 0) {
      await prisma.adminAuditLog.deleteMany({ where: { actorId: { in: ids } } });
      await prisma.adminAuditLog.deleteMany({ where: { targetId: { in: ids } } });
    }
    await prisma.user.deleteMany({ where: { displayName: { startsWith: TEST_PREFIX } } });
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
    const email = `${TEST_PREFIX}-${suffix}-${uniqueSuffix()}-${Math.random()
      .toString(36)
      .slice(2, 8)}@example.com`;
    const password = 'correct-horse-battery-staple';
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email, password, displayName: `${TEST_PREFIX}-${suffix}` },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body) as { userId: string; accessToken: string };
    return { ...body, email, password };
  }

  async function loginAsRole(
    suffix: string,
    role: 'admin' | 'compliance',
  ): Promise<{ token: string; userId: string }> {
    const reg = await registerUser(suffix);
    await prisma.user.update({ where: { id: reg.userId }, data: { role } });
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: reg.email, password: reg.password },
    });
    expect(login.statusCode).toBe(200);
    return {
      token: (JSON.parse(login.body) as { accessToken: string }).accessToken,
      userId: reg.userId,
    };
  }

  it('GET /compliance/retention without bearer → 401', async () => {
    if (!dbReachable) return;
    const res = await app.inject({ method: 'GET', url: '/api/v1/compliance/retention' });
    expect(res.statusCode).toBe(401);
  });

  it('regular user → 403 on /compliance/retention', async () => {
    if (!dbReachable) return;
    const { accessToken } = await registerUser('regular');
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/compliance/retention',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('compliance role → retention dashboard with seeded soft-delete count', async () => {
    if (!dbReachable) return;
    const compliance = await loginAsRole('compliance-actor', 'compliance');
    const victim = await registerUser('soft-deleted');
    await prisma.user.update({
      where: { id: victim.userId },
      data: { deletedAt: new Date() },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/compliance/retention',
      headers: { authorization: `Bearer ${compliance.token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as RetentionResp;
    expect(body.retentionDays).toBe(7);
    expect(body.users.softDeleted).toBeGreaterThanOrEqual(1);
    expect(typeof body.computedAt).toBe('string');
  });

  it('admin role can also read /compliance/retention', async () => {
    if (!dbReachable) return;
    const admin = await loginAsRole('admin-actor', 'admin');
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/compliance/retention',
      headers: { authorization: `Bearer ${admin.token}` },
    });
    expect(res.statusCode).toBe(200);
  });

  it('takedowns list includes delete_media but excludes ban', async () => {
    if (!dbReachable) return;
    const compliance = await loginAsRole('takedown-reader', 'compliance');
    const admin = await loginAsRole('takedown-actor', 'admin');

    // Seed: one delete_media audit row + one ban audit row, both
    // performed by `admin`. Takedown list must include the first
    // and exclude the second.
    const mediaTargetId = `media-${uniqueSuffix()}`;
    const userTargetId = `user-${uniqueSuffix()}`;
    await prisma.adminAuditLog.createMany({
      data: [
        {
          actorId: admin.userId,
          targetType: 'media',
          targetId: mediaTargetId,
          action: 'delete_media',
        },
        {
          actorId: admin.userId,
          targetType: 'user',
          targetId: userTargetId,
          action: 'ban',
          context: { reason: 'spam' },
        },
      ],
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/compliance/takedowns',
      headers: { authorization: `Bearer ${compliance.token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as TakedownsResp;
    const actions = body.rows.map((r) => r.action);
    expect(actions).toContain('delete_media');
    expect(actions).not.toContain('ban');
    // The seeded delete_media row should be in the response.
    expect(body.rows.some((r) => r.targetId === mediaTargetId && r.action === 'delete_media')).toBe(
      true,
    );

    // Cleanup the synthetic audit rows directly.
    await prisma.adminAuditLog.deleteMany({
      where: { targetId: { in: [mediaTargetId, userTargetId] } },
    });
  });
});
