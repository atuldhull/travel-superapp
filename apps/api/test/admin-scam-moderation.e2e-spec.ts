/**
 * Integration tests for admin moderation of ScamReport rows
 * ([IV.18.11.5]).
 *
 *   GET    /admin/safety/scam-reports          — list pending
 *   POST   /admin/safety/scam-reports/:id/verify
 *   POST   /admin/safety/scam-reports/:id/unverify
 *   DELETE /admin/safety/scam-reports/:id
 *
 * Exercises the full queue-triage flow: a user reports a scam →
 * admin sees it in the pending list → verifies or dismisses →
 * queue moves accordingly.
 *
 * Installed by prompt [IV.18.11.5].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';
import { uniqueEmail } from './factories';

const TEST_PREFIX = 'scam-mod-e2e';
// Empty slab of the Pacific — no other scam suite seeds here.
const ANCHOR = { lat: -9.1234, lng: 164.5678 };

interface ScamReportResp {
  readonly id: string;
  readonly category: string;
  readonly severity: string;
  readonly verified: boolean;
  readonly description: string;
}

describe('Admin scam-report moderation (integration, requires Postgres)', () => {
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
      console.warn(`admin-scam-mod test: infra not reachable (${message}). Skipping.`);
      dbReachable = false;
    }
  });

  afterEach(async () => {
    if (!dbReachable) return;
    // User cascade-deletes ScamReport rows.
    await prisma.user.deleteMany({
      where: { displayName: { startsWith: TEST_PREFIX } },
    });
  });

  afterAll(async () => {
    if (dbReachable) await app.close();
    await moduleRef.close();
  });

  async function registerUser(suffix: string): Promise<{ userId: string; accessToken: string }> {
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

  async function promoteToAdmin(userId: string): Promise<void> {
    await prisma.user.update({ where: { id: userId }, data: { role: 'admin' } });
  }

  async function loginAsAdmin(suffix: string): Promise<string> {
    const email = uniqueEmail(`${TEST_PREFIX}-${suffix}`);
    const reg = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email,
        password: 'correct-horse-battery-staple',
        displayName: `${TEST_PREFIX}-${suffix}`,
      },
    });
    const { userId } = JSON.parse(reg.body) as { userId: string };
    await promoteToAdmin(userId);
    // Re-login to get a token carrying role=admin in its claims.
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password: 'correct-horse-battery-staple' },
    });
    expect(login.statusCode).toBe(200);
    return (JSON.parse(login.body) as { accessToken: string }).accessToken;
  }

  async function submitScamReport(accessToken: string, suffix: string): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/safety/scam-reports',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        center: ANCHOR,
        category: 'pickpocket',
        severity: 'medium',
        description: `${TEST_PREFIX}-${suffix}: suspicious pickpocket activity reported here.`,
      },
    });
    expect(res.statusCode).toBe(201);
    return (JSON.parse(res.body) as { id: string }).id;
  }

  it('GET /admin/safety/scam-reports without a bearer → 401', async () => {
    if (!dbReachable) return;
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/safety/scam-reports',
    });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).code).toBe('UNAUTHENTICATED');
  });

  it('non-admin bearer → 403 ROLE_FORBIDDEN', async () => {
    if (!dbReachable) return;
    const { accessToken } = await registerUser('user');
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/safety/scam-reports',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body).code).toBe('ROLE_FORBIDDEN');
  });

  it('admin sees user-submitted reports in the pending queue', async () => {
    if (!dbReachable) return;
    const user = await registerUser('submitter');
    const reportId = await submitScamReport(user.accessToken, 'pending');
    const adminToken = await loginAsAdmin('admin-list');

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/safety/scam-reports',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { reports: ScamReportResp[] };
    const ours = body.reports.find((r) => r.id === reportId);
    expect(ours).toBeDefined();
    expect(ours!.verified).toBe(false);
  });

  it('verify flips verified=true; subsequent list (default pending) no longer shows it', async () => {
    if (!dbReachable) return;
    const user = await registerUser('verify-submitter');
    const reportId = await submitScamReport(user.accessToken, 'verify');
    const adminToken = await loginAsAdmin('admin-verify');

    const verify = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/safety/scam-reports/${reportId}/verify`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(verify.statusCode).toBe(200);
    expect(JSON.parse(verify.body).verified).toBe(true);

    // Default list (pending) no longer includes it.
    const pending = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/safety/scam-reports',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const pendingBody = JSON.parse(pending.body) as { reports: ScamReportResp[] };
    expect(pendingBody.reports.find((r) => r.id === reportId)).toBeUndefined();

    // ?verified=true now includes it.
    const verifiedList = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/safety/scam-reports?verified=true',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const verifiedBody = JSON.parse(verifiedList.body) as { reports: ScamReportResp[] };
    expect(verifiedBody.reports.find((r) => r.id === reportId)).toBeDefined();
  });

  it('unverify reverses a prior verify', async () => {
    if (!dbReachable) return;
    const user = await registerUser('unverify-submitter');
    const reportId = await submitScamReport(user.accessToken, 'unverify');
    const adminToken = await loginAsAdmin('admin-unverify');

    await app.inject({
      method: 'POST',
      url: `/api/v1/admin/safety/scam-reports/${reportId}/verify`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const unverify = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/safety/scam-reports/${reportId}/unverify`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(unverify.statusCode).toBe(200);
    expect(JSON.parse(unverify.body).verified).toBe(false);
  });

  it('dismiss (DELETE) removes the row; public search no longer finds it', async () => {
    if (!dbReachable) return;
    const user = await registerUser('dismiss-submitter');
    const reportId = await submitScamReport(user.accessToken, 'dismiss');
    const adminToken = await loginAsAdmin('admin-dismiss');

    const del = await app.inject({
      method: 'DELETE',
      url: `/api/v1/admin/safety/scam-reports/${reportId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(del.statusCode).toBe(204);

    // Public search near the anchor no longer returns our row.
    const search = await app.inject({
      method: 'POST',
      url: '/api/v1/safety/scam-reports/search',
      headers: { authorization: `Bearer ${user.accessToken}` },
      payload: { center: ANCHOR, radiusKm: 5 },
    });
    const body = JSON.parse(search.body) as { reports: Array<{ id: string }> };
    expect(body.reports.find((r) => r.id === reportId)).toBeUndefined();
  });

  it('verify unknown id → 404 SCAM_REPORT_NOT_FOUND', async () => {
    if (!dbReachable) return;
    const adminToken = await loginAsAdmin('admin-missing');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/safety/scam-reports/does-not-exist/verify',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).code).toBe('SCAM_REPORT_NOT_FOUND');
  });

  it('dismiss unknown id → 404 SCAM_REPORT_NOT_FOUND', async () => {
    if (!dbReachable) return;
    const adminToken = await loginAsAdmin('admin-missing-del');
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/v1/admin/safety/scam-reports/does-not-exist',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).code).toBe('SCAM_REPORT_NOT_FOUND');
  });
});
