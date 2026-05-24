/**
 * Integration tests for `POST /notifications/:id/read`
 * ([IV.18.15.2]).
 *
 * Uses real Postgres. Leans on the Identity register flow to seed
 * a `session_issued_new_device` NotificationLog row (the sender
 * persists it automatically — see [IV.18.15.1]), then exercises
 * the new mark-read endpoint against that row.
 *
 * Installed by prompt [IV.18.15.2].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';
import { uniqueEmail } from './factories';

const TEST_PREFIX = 'notif-read-e2e';

describe('POST /notifications/:id/read (integration, requires Docker Postgres)', () => {
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
      console.warn(`mark-read test: infra not reachable (${message}). Skipping.`);
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

  /**
   * Registration triggers the SessionIssuedHandler → sender → DB
   * insert. Returns the notification id for the authed user's
   * session-issued row.
   */
  async function sessionIssuedNotificationId(accessToken: string): Promise<string> {
    const list = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications/me',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(list.statusCode).toBe(200);
    const body = JSON.parse(list.body) as {
      notifications: Array<{ id: string; templateId: string }>;
    };
    const row = body.notifications.find((n) => n.templateId === 'session_issued_new_device');
    expect(row).toBeDefined();
    return row!.id;
  }

  it('POST /notifications/:id/read without a bearer → 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/notifications/some-id/read',
    });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).code).toBe('UNAUTHENTICATED');
  });

  it('happy path → flips read=true; subsequent GET /me reflects it', async () => {
    const { accessToken } = await registerUser('happy');
    const id = await sessionIssuedNotificationId(accessToken);

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/notifications/${id}/read`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { id: string; read: boolean };
    expect(body.id).toBe(id);
    expect(body.read).toBe(true);

    const list = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications/me',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const listBody = JSON.parse(list.body) as {
      notifications: Array<{ id: string; read: boolean }>;
    };
    const stillRead = listBody.notifications.find((n) => n.id === id)!;
    expect(stillRead.read).toBe(true);
  });

  it('unknown id → 404 NOTIFICATION_NOT_FOUND', async () => {
    const { accessToken } = await registerUser('missing');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/notifications/does-not-exist/read',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).code).toBe('NOTIFICATION_NOT_FOUND');
  });

  it('cross-user: Bob marks Alice’s → 404 NOTIFICATION_NOT_FOUND (IDOR defence)', async () => {
    const alice = await registerUser('alice');
    const bob = await registerUser('bob');
    const aliceId = await sessionIssuedNotificationId(alice.accessToken);

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/notifications/${aliceId}/read`,
      headers: { authorization: `Bearer ${bob.accessToken}` },
    });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).code).toBe('NOTIFICATION_NOT_FOUND');

    // Alice's row still unread.
    const aliceList = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications/me',
      headers: { authorization: `Bearer ${alice.accessToken}` },
    });
    const body = JSON.parse(aliceList.body) as {
      notifications: Array<{ id: string; read: boolean }>;
    };
    expect(body.notifications.find((n) => n.id === aliceId)!.read).toBe(false);
  });

  it('idempotent: a second mark-read call still returns 200 + read=true', async () => {
    const { accessToken } = await registerUser('idem');
    const id = await sessionIssuedNotificationId(accessToken);

    const first = await app.inject({
      method: 'POST',
      url: `/api/v1/notifications/${id}/read`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(first.statusCode).toBe(200);

    const second = await app.inject({
      method: 'POST',
      url: `/api/v1/notifications/${id}/read`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(second.statusCode).toBe(200);
    expect(JSON.parse(second.body).read).toBe(true);
  });
});
