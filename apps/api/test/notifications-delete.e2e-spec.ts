/**
 * Integration tests for `DELETE /api/v1/notifications/:id`
 * ([IV.18.15.6]).
 *
 * Closes the inbox-management arc:
 *   - Owner-scoped hard delete → 204; row gone.
 *   - Cross-user delete → 404 NOTIFICATION_NOT_FOUND
 *     (collapsed with id-unknown for IDOR safety).
 *   - Missing id → 404 NOTIFICATION_NOT_FOUND.
 *   - 401 without bearer.
 *
 * Fixture leans on the register flow which fires
 * `Identity.SessionIssued` → email NotificationLog row.
 *
 * Installed by prompt [IV.18.15.6].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';

const TEST_PREFIX = 'notif-delete-e2e';

describe('DELETE /notifications/:id (integration, requires Docker Postgres)', () => {
  let moduleRef: TestingModule;
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let dbReachable = true;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.useGlobalFilters(new AllExceptionFilter(), new DomainExceptionFilter());
    app.setGlobalPrefix('api/v1', { exclude: ['health', 'health/(.*)', 'metrics'] });
    await app.register(fastifyCookie);
    try {
      await app.init();
      await app.getHttpAdapter().getInstance().ready();
      prisma = moduleRef.get(PrismaService);
      await prisma.$queryRaw`SELECT 1`;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // eslint-disable-next-line no-console
      console.warn(`notifications-delete test: DB not reachable (${message}). Skipping.`);
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
        email: `${TEST_PREFIX}-${suffix}-${Date.now()}@example.com`,
        password: 'correct-horse-battery-staple',
        displayName: `${TEST_PREFIX}-${suffix}`,
      },
    });
    expect(res.statusCode).toBe(201);
    return JSON.parse(res.body) as { userId: string; accessToken: string };
  }

  async function listMine(token: string): Promise<{ id: string; templateId: string }[]> {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications/me',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    return (JSON.parse(res.body) as { notifications: { id: string; templateId: string }[] })
      .notifications;
  }

  it('DELETE without bearer → 401', async () => {
    if (!dbReachable) return;
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/v1/notifications/some-id',
    });
    expect(res.statusCode).toBe(401);
  });

  it('owner delete → 204; row is gone from list', async () => {
    if (!dbReachable) return;
    const u = await registerUser('owner');
    const rows = await listMine(u.accessToken);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    const target = rows[0]!;

    const del = await app.inject({
      method: 'DELETE',
      url: `/api/v1/notifications/${target.id}`,
      headers: { authorization: `Bearer ${u.accessToken}` },
    });
    expect(del.statusCode).toBe(204);

    const after = await listMine(u.accessToken);
    expect(after.some((n) => n.id === target.id)).toBe(false);
  });

  it('cross-user delete → 404 NOTIFICATION_NOT_FOUND (IDOR-safe)', async () => {
    if (!dbReachable) return;
    const owner = await registerUser('victim');
    const attacker = await registerUser('attacker');

    const rows = await listMine(owner.accessToken);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    const targetId = rows[0]!.id;

    const del = await app.inject({
      method: 'DELETE',
      url: `/api/v1/notifications/${targetId}`,
      headers: { authorization: `Bearer ${attacker.accessToken}` },
    });
    expect(del.statusCode).toBe(404);
    expect(JSON.parse(del.body).code).toBe('NOTIFICATION_NOT_FOUND');

    // Owner still has the row.
    const ownerRows = await listMine(owner.accessToken);
    expect(ownerRows.some((n) => n.id === targetId)).toBe(true);
  });

  it('unknown id → 404 NOTIFICATION_NOT_FOUND', async () => {
    if (!dbReachable) return;
    const u = await registerUser('missing');
    const del = await app.inject({
      method: 'DELETE',
      url: '/api/v1/notifications/does-not-exist',
      headers: { authorization: `Bearer ${u.accessToken}` },
    });
    expect(del.statusCode).toBe(404);
    expect(JSON.parse(del.body).code).toBe('NOTIFICATION_NOT_FOUND');
  });
});
