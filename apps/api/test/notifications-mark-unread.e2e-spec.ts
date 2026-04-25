/**
 * Integration tests for `POST /notifications/:id/unread`
 * ([IV.18.15.5]).
 *
 * Symmetric companion to mark-read. Useful when the user
 * accidentally read something they wanted to come back to.
 *
 *   1. No bearer → 401.
 *   2. Happy path: mark a read row unread → row reflects;
 *      unread-count goes back up.
 *   3. IDOR defence: Bob marks Alice's notification → 404
 *      NOTIFICATION_NOT_FOUND.
 *   4. Idempotent: marking an already-unread row → still 200.
 *   5. Unknown id → 404 NOTIFICATION_NOT_FOUND.
 *
 * Installed by prompt [IV.18.15.5].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';

const TEST_PREFIX = 'notif-unread-mark-e2e';

describe('POST /notifications/:id/unread (integration, requires Docker Postgres)', () => {
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
      console.warn(`mark-unread test: DB not reachable (${message}). Skipping.`);
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

  /** Returns the registration-time `session_issued_new_device` notification id. */
  async function sessionIssuedNotificationId(accessToken: string): Promise<string> {
    const list = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications/me',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const body = JSON.parse(list.body) as {
      notifications: Array<{ id: string; templateId: string }>;
    };
    const row = body.notifications.find((n) => n.templateId === 'session_issued_new_device');
    expect(row).toBeDefined();
    return row!.id;
  }

  it('without bearer → 401', async () => {
    if (!dbReachable) return;
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/notifications/some-id/unread',
    });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).code).toBe('UNAUTHENTICATED');
  });

  it('happy path → flips read=false; unread-count increments', async () => {
    if (!dbReachable) return;
    const { accessToken } = await registerUser('happy');
    const id = await sessionIssuedNotificationId(accessToken);

    // First read it via mark-read so we know it's currently `read: true`.
    await app.inject({
      method: 'POST',
      url: `/api/v1/notifications/${id}/read`,
      headers: { authorization: `Bearer ${accessToken}` },
    });

    // Sanity — unread count is 0 now (only one notification, just marked read).
    const before = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications/me/unread-count',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(JSON.parse(before.body).unread).toBe(0);

    // Mark it unread again.
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/notifications/${id}/unread`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { id: string; read: boolean };
    expect(body.id).toBe(id);
    expect(body.read).toBe(false);

    // Unread count back up.
    const after = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications/me/unread-count',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(JSON.parse(after.body).unread).toBe(1);
  });

  it('IDOR defence: Bob marks Alice’s notification unread → 404 NOTIFICATION_NOT_FOUND', async () => {
    if (!dbReachable) return;
    const alice = await registerUser('alice');
    const bob = await registerUser('bob');
    const aliceId = await sessionIssuedNotificationId(alice.accessToken);

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/notifications/${aliceId}/unread`,
      headers: { authorization: `Bearer ${bob.accessToken}` },
    });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).code).toBe('NOTIFICATION_NOT_FOUND');
  });

  it('idempotent: marking an already-unread row → still 200, read=false', async () => {
    if (!dbReachable) return;
    const { accessToken } = await registerUser('idem');
    const id = await sessionIssuedNotificationId(accessToken);
    // The row starts unread (registration default). Mark unread anyway.
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/notifications/${id}/unread`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).read).toBe(false);
  });

  it('unknown id → 404 NOTIFICATION_NOT_FOUND', async () => {
    if (!dbReachable) return;
    const { accessToken } = await registerUser('missing');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/notifications/does-not-exist/unread',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).code).toBe('NOTIFICATION_NOT_FOUND');
  });
});
