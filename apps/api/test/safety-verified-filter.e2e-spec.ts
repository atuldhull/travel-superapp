/**
 * Integration tests for the public scam-search `verifiedOnly`
 * filter ([IV.18.11.6]).
 *
 * Closes the moderation flywheel added in [IV.18.11.5]: crowd
 * users report → admins verify → clients can now filter to
 * trusted-only via `verifiedOnly: true`. Default behaviour
 * unchanged — unverified reports still surface on an unfiltered
 * search so the crowd-sourcing signal doesn't die waiting for
 * admin attention.
 *
 * Suite-local coord to avoid cross-suite contamination.
 *
 * Installed by prompt [IV.18.11.6].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';
import { uniqueEmail } from './factories';

const TEST_PREFIX = 'scam-vfilter-e2e';
// Empty Arctic quadrant — no other scam test seeds near here.
const REMOTE = { lat: 78.1234, lng: 12.3456 };

interface ReportResp {
  readonly id: string;
  readonly verified: boolean;
}

describe('Scam search verifiedOnly filter (integration, requires Postgres)', () => {
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
      console.warn(`verified-filter test: infra not reachable (${message}). Skipping.`);
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
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password: 'correct-horse-battery-staple' },
    });
    expect(login.statusCode).toBe(200);
    return (JSON.parse(login.body) as { accessToken: string }).accessToken;
  }

  async function submitReport(accessToken: string, description: string): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/safety/scam-reports',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        center: REMOTE,
        category: 'pickpocket',
        severity: 'medium',
        description,
      },
    });
    expect(res.statusCode).toBe(201);
    return (JSON.parse(res.body) as { id: string }).id;
  }

  async function search(
    accessToken: string,
    extra: Record<string, unknown> = {},
  ): Promise<ReportResp[]> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/safety/scam-reports/search',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { center: REMOTE, radiusKm: 5, ...extra },
    });
    expect(res.statusCode).toBe(200);
    return (JSON.parse(res.body) as { reports: ReportResp[] }).reports;
  }

  it('default search (no verifiedOnly) returns BOTH verified + unverified reports', async () => {
    if (!dbReachable) return;
    const reporter = await registerUser('both-reporter');
    const searcher = await registerUser('both-searcher');
    const unverifiedId = await submitReport(
      reporter.accessToken,
      `${TEST_PREFIX}: unverified for default-search test.`,
    );
    const verifiedId = await submitReport(
      reporter.accessToken,
      `${TEST_PREFIX}: verified for default-search test.`,
    );

    // Admin verifies one of the two reports.
    const adminToken = await loginAsAdmin('both-admin');
    await app.inject({
      method: 'POST',
      url: `/api/v1/admin/safety/scam-reports/${verifiedId}/verify`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    const reports = await search(searcher.accessToken);
    const ids = reports.map((r) => r.id);
    expect(ids).toContain(unverifiedId);
    expect(ids).toContain(verifiedId);
  });

  it('verifiedOnly=true restricts to admin-verified reports only', async () => {
    if (!dbReachable) return;
    const reporter = await registerUser('filter-reporter');
    const searcher = await registerUser('filter-searcher');
    const unverifiedId = await submitReport(
      reporter.accessToken,
      `${TEST_PREFIX}: unverified for filter test.`,
    );
    const verifiedId = await submitReport(
      reporter.accessToken,
      `${TEST_PREFIX}: verified for filter test.`,
    );

    const adminToken = await loginAsAdmin('filter-admin');
    await app.inject({
      method: 'POST',
      url: `/api/v1/admin/safety/scam-reports/${verifiedId}/verify`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    const reports = await search(searcher.accessToken, { verifiedOnly: true });
    const ids = reports.map((r) => r.id);
    expect(ids).toContain(verifiedId);
    expect(ids).not.toContain(unverifiedId);
    // And every returned row has verified=true.
    expect(reports.every((r) => r.verified)).toBe(true);
  });

  it('verifiedOnly=true with no verified reports in the area → empty list', async () => {
    if (!dbReachable) return;
    const reporter = await registerUser('empty-reporter');
    const searcher = await registerUser('empty-searcher');
    await submitReport(reporter.accessToken, `${TEST_PREFIX}: only unverified here.`);

    const reports = await search(searcher.accessToken, { verifiedOnly: true });
    // No verified reports → empty array, despite an unverified row existing.
    expect(reports).toEqual([]);
  });

  it('verifiedOnly=false behaves like absent (returns both)', async () => {
    if (!dbReachable) return;
    const reporter = await registerUser('false-reporter');
    const searcher = await registerUser('false-searcher');
    const unverifiedId = await submitReport(
      reporter.accessToken,
      `${TEST_PREFIX}: unverified only.`,
    );

    const reports = await search(searcher.accessToken, { verifiedOnly: false });
    expect(reports.map((r) => r.id)).toContain(unverifiedId);
  });
});
