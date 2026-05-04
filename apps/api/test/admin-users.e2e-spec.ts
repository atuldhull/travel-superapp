/**
 * Integration tests for the admin user-management surface
 * ([IV.18.18.1]).
 *
 *   GET  /admin/users?role=&deleted=&q=&limit=&offset=
 *   POST /admin/users/:id/ban
 *   POST /admin/users/:id/unban
 *
 * Uses real Postgres. The ban path REUSES the AccountDeleter
 * plumbing shipped in [IV.18.16.2] — we verify the soft-delete
 * + session revoke happens via that path on an admin call.
 *
 * Installed by prompt [IV.18.18.1].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';

const TEST_PREFIX = 'admin-users-e2e';

interface AdminUserResp {
  id: string;
  emailHash: string;
  displayName: string;
  role: string;
  mfaEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

interface ListResp {
  users: AdminUserResp[];
  total: number;
}

describe('Admin user moderation (integration, requires Docker Postgres)', () => {
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
      console.warn(`admin-users test: DB not reachable (${message}). Skipping.`);
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
    const email = `${TEST_PREFIX}-${suffix}-${Date.now()}@example.com`;
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

  async function listUsers(token: string, query = ''): Promise<{ status: number; body: ListResp }> {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/users${query}`,
      headers: { authorization: `Bearer ${token}` },
    });
    return { status: res.statusCode, body: JSON.parse(res.body) as ListResp };
  }

  it('GET /admin/users without bearer → 401', async () => {
    if (!dbReachable) return;
    const res = await app.inject({ method: 'GET', url: '/api/v1/admin/users' });
    expect(res.statusCode).toBe(401);
  });

  it('non-admin caller → 403', async () => {
    if (!dbReachable) return;
    const { accessToken } = await registerUser('non-admin');
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/users',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('admin list with no filters returns paginated users + total', async () => {
    if (!dbReachable) return;
    const adminToken = await loginAsAdmin('list-admin');
    await registerUser('alice');
    await registerUser('bob');

    const { status, body } = await listUsers(adminToken, `?q=${encodeURIComponent(TEST_PREFIX)}`);
    expect(status).toBe(200);
    expect(Array.isArray(body.users)).toBe(true);
    expect(body.total).toBeGreaterThanOrEqual(3); // alice + bob + admin
    // Sensitive columns absent.
    for (const u of body.users) {
      expect(u).not.toHaveProperty('passwordHash');
      expect(u).not.toHaveProperty('mfaSecret');
      expect(u).not.toHaveProperty('emailEncrypted');
      expect(u.emailHash).toMatch(/^[0-9a-f]+$/i);
    }
  });

  it('?role=admin returns only admins', async () => {
    if (!dbReachable) return;
    const adminToken = await loginAsAdmin('role-admin');
    await registerUser('regular');

    const { body } = await listUsers(
      adminToken,
      `?role=admin&q=${encodeURIComponent(TEST_PREFIX)}`,
    );
    for (const u of body.users) {
      expect(u.role).toBe('admin');
    }
    expect(body.users.length).toBeGreaterThanOrEqual(1);
  });

  it('?deleted=true returns only soft-deleted users', async () => {
    if (!dbReachable) return;
    const adminToken = await loginAsAdmin('deleted-filter');
    const banned = await registerUser('to-ban');
    await prisma.user.update({
      where: { id: banned.userId },
      data: { deletedAt: new Date() },
    });

    const { body } = await listUsers(
      adminToken,
      `?deleted=true&q=${encodeURIComponent(TEST_PREFIX)}`,
    );
    expect(body.users.length).toBeGreaterThanOrEqual(1);
    for (const u of body.users) {
      expect(u.deletedAt).not.toBeNull();
    }
  });

  it('?q=alice does case-insensitive substring match on displayName', async () => {
    if (!dbReachable) return;
    const adminToken = await loginAsAdmin('q-search');
    const alice = await registerUser('alice-case-test');
    await registerUser('bob-distinct');

    const { body } = await listUsers(adminToken, `?q=alice-case-test`);
    expect(body.users.some((u) => u.id === alice.userId)).toBe(true);
    expect(body.users.every((u) => u.displayName.includes('alice-case-test'))).toBe(true);
  });

  it('ban (V.UX.34): target user is banned + sessions revoked + login fails with ACCOUNT_BANNED', async () => {
    if (!dbReachable) return;
    const adminToken = await loginAsAdmin('banner');
    const target = await registerUser('ban-target');
    // Sanity — sessions are live.
    const beforeSessions = await prisma.session.count({
      where: { userId: target.userId, revokedAt: null },
    });
    expect(beforeSessions).toBeGreaterThanOrEqual(1);

    const ban = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/users/${target.userId}/ban`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { reason: 'Repeated TOS violations.' },
    });
    expect(ban.statusCode).toBe(204);

    // V.UX.34 — bannedAt + banReason set; deletedAt stays null.
    const u = await prisma.user.findUnique({ where: { id: target.userId } });
    expect(u!.bannedAt).not.toBeNull();
    expect(u!.banReason).toBe('Repeated TOS violations.');
    expect(u!.deletedAt).toBeNull();
    // Sessions revoked.
    const liveSessions = await prisma.session.count({
      where: { userId: target.userId, revokedAt: null },
    });
    expect(liveSessions).toBe(0);

    // Subsequent login surfaces the ban-with-reason challenge.
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: target.email, password: target.password },
    });
    expect(login.statusCode).toBe(401);
    const body = JSON.parse(login.body) as { code: string; context: { banReason?: string } };
    expect(body.code).toBe('ACCOUNT_BANNED');
    expect(body.context.banReason).toBe('Repeated TOS violations.');
  });

  it('ban (V.UX.34): idempotent — second ban on already-banned user refreshes reason', async () => {
    if (!dbReachable) return;
    const adminToken = await loginAsAdmin('idem-ban');
    const target = await registerUser('idem-target');

    const first = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/users/${target.userId}/ban`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { reason: 'First reason.' },
    });
    expect(first.statusCode).toBe(204);

    const second = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/users/${target.userId}/ban`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { reason: 'Updated reason.' },
    });
    expect(second.statusCode).toBe(204);

    const u = await prisma.user.findUnique({ where: { id: target.userId } });
    expect(u!.banReason).toBe('Updated reason.');
  });

  it('unban (V.UX.34): clears bannedAt; user can log in again', async () => {
    if (!dbReachable) return;
    const adminToken = await loginAsAdmin('unbanner');
    const target = await registerUser('unban-target');

    // Ban then unban.
    await app.inject({
      method: 'POST',
      url: `/api/v1/admin/users/${target.userId}/ban`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { reason: 'Spam suspicion.' },
    });
    const unban = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/users/${target.userId}/unban`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(unban.statusCode).toBe(204);

    const u = await prisma.user.findUnique({ where: { id: target.userId } });
    expect(u!.bannedAt).toBeNull();
    expect(u!.banReason).toBeNull();

    // Login works again.
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: target.email, password: target.password },
    });
    expect(login.statusCode).toBe(200);
  });

  it('unban: target who was never banned → 404', async () => {
    if (!dbReachable) return;
    const adminToken = await loginAsAdmin('unban-active');
    const target = await registerUser('always-active');

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/users/${target.userId}/unban`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).code).toBe('USER_NOT_FOUND');
  });

  it('non-admin caller can’t ban', async () => {
    if (!dbReachable) return;
    const attacker = await registerUser('attacker');
    const target = await registerUser('victim');

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/users/${target.userId}/ban`,
      headers: { authorization: `Bearer ${attacker.accessToken}` },
    });
    expect(res.statusCode).toBe(403);

    const u = await prisma.user.findUnique({ where: { id: target.userId } });
    expect(u!.deletedAt).toBeNull();
  });
});
