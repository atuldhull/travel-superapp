/**
 * Integration tests for `POST /notifications/read-all` ([IV.18.15.3]).
 *
 * "Clear the badge" surface — flips `read = true` on every unread
 * row for the caller in one round-trip, returning `{ marked }`.
 * Idempotent by construction (the `read: false` clause skips
 * already-read rows; second call returns `{ marked: 0 }`).
 *
 * Uses real Postgres. Seeds extra NotificationLog rows directly so
 * tests don't rely on triggering a real notification flow N times.
 *
 * Installed by prompt [IV.18.15.3].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';

const TEST_PREFIX = 'notif-readall-e2e';

describe('POST /notifications/read-all (integration, requires Docker Postgres)', () => {
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
      console.warn(`mark-all-read test: DB not reachable (${message}). Skipping.`);
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

  /** Seed N additional unread NotificationLog rows for a user. */
  async function seedUnread(userId: string, n: number): Promise<void> {
    for (let i = 0; i < n; i++) {
      await prisma.notificationLog.create({
        data: {
          userId,
          channel: 'push',
          templateId: `seed_${i}`,
          status: 'delivered',
          payload: { i },
          read: false,
          deliveredAt: new Date(),
        },
      });
    }
  }

  it('POST /notifications/read-all without bearer → 401', async () => {
    if (!dbReachable) return;
    const res = await app.inject({ method: 'POST', url: '/api/v1/notifications/read-all' });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).code).toBe('UNAUTHENTICATED');
  });

  it('happy path → marks every unread row; idempotent on a second call', async () => {
    if (!dbReachable) return;
    const { userId, accessToken } = await registerUser('happy');
    // Registration mints 1 notification (session_issued). Add 3 more.
    await seedUnread(userId, 3);

    const before = await prisma.notificationLog.count({ where: { userId, read: false } });
    expect(before).toBeGreaterThanOrEqual(4);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/notifications/read-all',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { marked: number };
    expect(body.marked).toBe(before);

    const stillUnread = await prisma.notificationLog.count({ where: { userId, read: false } });
    expect(stillUnread).toBe(0);

    // Second call → no new unread rows → marked: 0.
    const second = await app.inject({
      method: 'POST',
      url: '/api/v1/notifications/read-all',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(second.statusCode).toBe(200);
    expect(JSON.parse(second.body).marked).toBe(0);
  });

  it('cross-user isolation: Bob’s read-all leaves Alice’s rows unread', async () => {
    if (!dbReachable) return;
    const alice = await registerUser('alice');
    const bob = await registerUser('bob');
    await seedUnread(alice.userId, 5);
    await seedUnread(bob.userId, 2);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/notifications/read-all',
      headers: { authorization: `Bearer ${bob.accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { marked: number };
    // Bob had: registration row + 2 seeded = 3 unread.
    expect(body.marked).toBe(3);

    // Bob's inbox now empty of unread.
    const bobUnread = await prisma.notificationLog.count({
      where: { userId: bob.userId, read: false },
    });
    expect(bobUnread).toBe(0);

    // Alice's inbox untouched: registration + 5 seeded = 6 unread.
    const aliceUnread = await prisma.notificationLog.count({
      where: { userId: alice.userId, read: false },
    });
    expect(aliceUnread).toBe(6);
  });

  it('empty inbox → 200 { marked: 0 } (NOT 404)', async () => {
    if (!dbReachable) return;
    const { userId, accessToken } = await registerUser('empty');
    // Mark the registration-time row read first so the inbox has zero unread.
    await prisma.notificationLog.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/notifications/read-all',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).marked).toBe(0);
  });
});
