/**
 * Integration tests for `GET /notifications/me/unread-count`
 * ([IV.18.15.4]).
 *
 * Home-screen badge primitive — single indexed Prisma `count`
 * over `[userId, read, createdAt]`. Drives the unread badge
 * without paginating the inbox via `GET /me`.
 *
 *   1. No bearer → 401.
 *   2. Empty inbox (registration row pre-marked) → `{ unread: 0 }`.
 *   3. Fresh registration mints 1 unread (session_issued) →
 *      `{ unread: 1 }` + correctly increments after seeding more.
 *   4. After mark-all-read → `{ unread: 0 }`.
 *   5. Cross-user isolation: Alice's unread doesn't leak into
 *      Bob's count.
 *
 * Installed by prompt [IV.18.15.4].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';
import { uniqueEmail } from './factories';

const TEST_PREFIX = 'notif-unread-e2e';

describe('GET /notifications/me/unread-count (integration, requires Docker Postgres)', () => {
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
      console.warn(`unread-count test: DB not reachable (${message}). Skipping.`);
      dbReachable = false;
    }
  });

  afterEach(async () => {
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

  async function getUnread(token: string): Promise<{ unread: number }> {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications/me/unread-count',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    return JSON.parse(res.body) as { unread: number };
  }

  it('without bearer → 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications/me/unread-count',
    });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).code).toBe('UNAUTHENTICATED');
  });

  it('empty inbox → { unread: 0 }', async () => {
    const { userId, accessToken } = await registerUser('empty');
    // Mark the registration-time session_issued row read so the
    // inbox starts at zero.
    await prisma.notificationLog.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
    const body = await getUnread(accessToken);
    expect(body).toEqual({ unread: 0 });
  });

  it('counts unread including the registration-time row + seeded extras', async () => {
    const { userId, accessToken } = await registerUser('count');
    // Registration mints 1 (session_issued).
    const baseline = await getUnread(accessToken);
    expect(baseline.unread).toBe(1);
    // Seed 4 more.
    await seedUnread(userId, 4);
    const after = await getUnread(accessToken);
    expect(after.unread).toBe(5);
  });

  it('after mark-all-read → { unread: 0 }', async () => {
    const { userId, accessToken } = await registerUser('postmark');
    await seedUnread(userId, 3);
    // mark-all-read endpoint flips every unread row.
    await app.inject({
      method: 'POST',
      url: '/api/v1/notifications/read-all',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const body = await getUnread(accessToken);
    expect(body.unread).toBe(0);
  });

  it('cross-user isolation: Alice’s unread doesn’t leak into Bob’s count', async () => {
    const alice = await registerUser('alice');
    const bob = await registerUser('bob');
    await seedUnread(alice.userId, 7);
    // Bob untouched (only the registration row).
    const aliceCount = await getUnread(alice.accessToken);
    const bobCount = await getUnread(bob.accessToken);
    // Alice: 1 registration + 7 seeded = 8.
    expect(aliceCount.unread).toBe(8);
    // Bob: 1 registration only.
    expect(bobCount.unread).toBe(1);
  });
});
