/**
 * V.UX.36 — admin audit log integration tests.
 *
 *   GET /api/v1/admin/audit-logs?actorId=&targetType=&targetId=&action=&limit=&offset=
 *
 * Verifies:
 *   1. Auth gate: anon → 401, non-admin → 403.
 *   2. Ban writes one {targetType:'user', action:'ban', context:{reason}} row.
 *   3. Verify-scam writes one {action:'verify_scam', context:{verified:true}} row.
 *   4. Resolve-sos writes one {action:'resolve_sos'} row (note round-trips).
 *   5. Filters: ?action=ban returns only ban rows; ?actorId scopes to one admin.
 *   6. Newest-first ordering on the list.
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';
import { uniqueSuffix } from './factories';

const TEST_PREFIX = 'admin-audit-e2e';

interface AuditRow {
  id: string;
  actorId: string;
  targetType: string;
  targetId: string;
  action: string;
  context: Record<string, unknown> | null;
  createdAt: string;
}

interface ListResp {
  rows: AuditRow[];
  total: number;
}

describe('V.UX.36 — Admin audit log (integration, requires Docker Postgres)', () => {
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
  });

  afterEach(async () => {
    // V.UX.36 — wipe audit rows tied to actors created by this suite,
    // then drop those users + their child trips/scam reports/sos.
    const ourUsers = await prisma.user.findMany({
      where: { displayName: { startsWith: TEST_PREFIX } },
      select: { id: true },
    });
    const ids = ourUsers.map((u) => u.id);
    if (ids.length > 0) {
      await prisma.adminAuditLog.deleteMany({ where: { actorId: { in: ids } } });
      await prisma.adminAuditLog.deleteMany({ where: { targetId: { in: ids } } });
    }
    await prisma.user.deleteMany({
      where: { displayName: { startsWith: TEST_PREFIX } },
    });
  });

  afterAll(async () => {
    await app.close();
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

  async function loginAsAdmin(suffix: string): Promise<{ token: string; userId: string }> {
    const reg = await registerUser(suffix);
    await prisma.user.update({ where: { id: reg.userId }, data: { role: 'admin' } });
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

  async function listAudit(token: string, query = ''): Promise<{ status: number; body: ListResp }> {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/audit-logs${query}`,
      headers: { authorization: `Bearer ${token}` },
    });
    return { status: res.statusCode, body: JSON.parse(res.body) as ListResp };
  }

  it('GET /admin/audit-logs without bearer → 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/admin/audit-logs' });
    expect(res.statusCode).toBe(401);
  });

  it('non-admin caller → 403', async () => {
    const { accessToken } = await registerUser('non-admin');
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/audit-logs',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('ban a user → audit row {targetType:user, action:ban, context:{reason}}', async () => {
    const admin = await loginAsAdmin('ban-actor');
    const target = await registerUser('ban-target');

    const ban = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/users/${target.userId}/ban`,
      headers: { authorization: `Bearer ${admin.token}` },
      payload: { reason: 'Repeated TOS violations.' },
    });
    expect(ban.statusCode).toBe(204);

    const { status, body } = await listAudit(admin.token, `?actorId=${admin.userId}&action=ban`);
    expect(status).toBe(200);
    expect(body.total).toBe(1);
    expect(body.rows).toHaveLength(1);
    const row = body.rows[0]!;
    expect(row.actorId).toBe(admin.userId);
    expect(row.targetType).toBe('user');
    expect(row.targetId).toBe(target.userId);
    expect(row.action).toBe('ban');
    expect(row.context).toEqual({ reason: 'Repeated TOS violations.' });
  });

  it('verify-scam writes one {action:verify_scam, context:{verified:true}}', async () => {
    const admin = await loginAsAdmin('verify-actor');
    const reporter = await registerUser('reporter');

    // Seed a scam report directly via Prisma (bypassing PostGIS to keep
    // the test simple — the public scam-report endpoint requires
    // GeoQueries which isn't strictly necessary for an audit-log test).
    const reportId = `scam-${uniqueSuffix()}`;
    await prisma.$executeRaw`
      INSERT INTO "ScamReport"
        ("id", "reporterId", "category", "severity", "description",
         "evidenceUrls", "verified", "coordinates", "createdAt", "updatedAt")
      VALUES
        (${reportId}, ${reporter.userId}, 'taxi-overcharge', 'low'::"ScamSeverity",
         'fake report for audit-log test', ARRAY[]::text[], false,
         ST_SetSRID(ST_MakePoint(2.3, 48.8), 4326)::geography,
         NOW(), NOW())
    `;

    const verify = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/safety/scam-reports/${reportId}/verify`,
      headers: { authorization: `Bearer ${admin.token}` },
    });
    expect(verify.statusCode).toBe(200);

    const { body } = await listAudit(admin.token, `?targetType=scam_report&targetId=${reportId}`);
    expect(body.total).toBe(1);
    const row = body.rows[0]!;
    expect(row.action).toBe('verify_scam');
    expect(row.context).toEqual({ verified: true });
    expect(row.actorId).toBe(admin.userId);

    await prisma.$executeRaw`DELETE FROM "ScamReport" WHERE "id" = ${reportId}`;
  });

  it('resolve-sos writes one {action:resolve_sos, context:{note}}', async () => {
    const admin = await loginAsAdmin('sos-actor');
    const victim = await registerUser('sos-victim');

    const sosId = `sos-${uniqueSuffix()}`;
    await prisma.$executeRaw`
      INSERT INTO "SosEvent"
        ("id", "userId", "trigger", "coordinates", "createdAt")
      VALUES
        (${sosId}, ${victim.userId}, 'panic',
         ST_SetSRID(ST_MakePoint(0, 0), 4326)::geography,
         NOW())
    `;

    const resolve = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/safety/sos-events/${sosId}/resolve`,
      headers: { authorization: `Bearer ${admin.token}` },
      payload: { note: 'Confirmed safe out-of-band.' },
    });
    expect(resolve.statusCode).toBe(200);

    const { body } = await listAudit(admin.token, `?targetType=sos&targetId=${sosId}`);
    expect(body.total).toBe(1);
    const row = body.rows[0]!;
    expect(row.action).toBe('resolve_sos');
    expect(row.context).toEqual({ note: 'Confirmed safe out-of-band.' });

    await prisma.$executeRaw`DELETE FROM "SosEvent" WHERE "id" = ${sosId}`;
  });

  it('filters: ?action=ban scopes the list to ban rows only', async () => {
    const admin = await loginAsAdmin('filter-actor');
    const target1 = await registerUser('filter-target-1');
    const target2 = await registerUser('filter-target-2');

    await app.inject({
      method: 'POST',
      url: `/api/v1/admin/users/${target1.userId}/ban`,
      headers: { authorization: `Bearer ${admin.token}` },
      payload: { reason: 'Reason 1' },
    });
    await app.inject({
      method: 'POST',
      url: `/api/v1/admin/users/${target2.userId}/ban`,
      headers: { authorization: `Bearer ${admin.token}` },
      payload: { reason: 'Reason 2' },
    });
    await app.inject({
      method: 'POST',
      url: `/api/v1/admin/users/${target1.userId}/unban`,
      headers: { authorization: `Bearer ${admin.token}` },
    });

    // ?action=ban → should be exactly 2 rows for THIS admin.
    const banOnly = await listAudit(admin.token, `?actorId=${admin.userId}&action=ban`);
    expect(banOnly.body.total).toBe(2);
    for (const r of banOnly.body.rows) {
      expect(r.action).toBe('ban');
    }

    // ?action=unban → exactly 1.
    const unbanOnly = await listAudit(admin.token, `?actorId=${admin.userId}&action=unban`);
    expect(unbanOnly.body.total).toBe(1);
    expect(unbanOnly.body.rows[0]!.action).toBe('unban');

    // No filter (scoped to actor) → 3 total.
    const all = await listAudit(admin.token, `?actorId=${admin.userId}`);
    expect(all.body.total).toBe(3);

    // Newest-first: the unban (last action) should be first.
    expect(all.body.rows[0]!.action).toBe('unban');
  });
});
