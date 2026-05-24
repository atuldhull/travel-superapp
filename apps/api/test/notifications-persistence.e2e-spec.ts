/**
 * Integration tests for the persistent NotificationLog write-path
 * + the `GET /api/v1/notifications/me` read surface ([IV.18.15.1]).
 *
 *   POST /safety/sos     → Safety.SosTriggered event published
 *                          → SosTriggeredHandler subscribes
 *                          → LoggingNotificationSender.send()
 *                          → NotificationLog row inserted
 *   GET  /notifications/me → returns rows for authed user only
 *
 * Skips cleanly when Docker infra is down. Sister suite to
 * `notifications.e2e-spec.ts`, which exercises the in-memory log
 * for SessionIssued + ItineraryGenerated.
 *
 * Installed by prompt [IV.18.15.1].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';
import { LoggingNotificationSender } from '../src/modules/notifications/infrastructure/logging-notification-sender';
import { uniqueEmail } from './factories';

const TEST_PREFIX = 'notif-persist-e2e';
// Suite-local coord (see memory/feedback_unique_test_coords.md).
const REMOTE = { lat: 11.2233, lng: -27.4455 };

describe('Notifications persistence + GET /notifications/me (integration)', () => {
  let moduleRef: TestingModule;
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let sender: LoggingNotificationSender;
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
      sender = moduleRef.get(LoggingNotificationSender);
      await prisma.$queryRaw`SELECT 1`;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // eslint-disable-next-line no-console
      console.warn(`notifications-persistence test: infra not reachable (${message}). Skipping.`);
      dbReachable = false;
    }
  });

  afterEach(async () => {
    if (!dbReachable) return;
    sender.drainSent();
    // User cascade-deletes NotificationLog rows.
    await prisma.user.deleteMany({
      where: { displayName: { startsWith: TEST_PREFIX } },
    });
  });

  afterAll(async () => {
    if (dbReachable) {
      await app.close();
    }
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

  it('GET /notifications/me without a bearer → 401', async () => {
    if (!dbReachable) return;
    const res = await app.inject({ method: 'GET', url: '/api/v1/notifications/me' });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).code).toBe('UNAUTHENTICATED');
  });

  it('register triggers Identity.SessionIssued → row appears in NotificationLog + GET /me', async () => {
    if (!dbReachable) return;
    const { userId, accessToken } = await registerUser('reg');

    const list = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications/me',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(list.statusCode).toBe(200);
    const body = JSON.parse(list.body) as {
      notifications: Array<{
        templateId: string;
        channel: string;
        status: string;
        deliveredAt: string | null;
      }>;
    };
    const sessionRow = body.notifications.find((n) => n.templateId === 'session_issued_new_device');
    expect(sessionRow).toBeDefined();
    expect(sessionRow!.channel).toBe('email');
    expect(sessionRow!.status).toBe('delivered');
    expect(sessionRow!.deliveredAt).not.toBeNull();
    void userId;
  });

  it('POST /safety/sos triggers Safety.SosTriggered → SosTriggeredHandler → push row', async () => {
    if (!dbReachable) return;
    const { accessToken } = await registerUser('sos');

    const triggered = await app.inject({
      method: 'POST',
      url: '/api/v1/safety/sos',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { center: REMOTE, trigger: 'user_tap' },
    });
    expect(triggered.statusCode).toBe(201);
    const sosId = (JSON.parse(triggered.body) as { id: string }).id;

    const list = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications/me',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(list.statusCode).toBe(200);
    const body = JSON.parse(list.body) as {
      notifications: Array<{
        templateId: string;
        channel: string;
        payload: { context: { sosEventId: string; trigger: string } };
      }>;
    };
    const sosRow = body.notifications.find((n) => n.templateId === 'safety_sos_received');
    expect(sosRow).toBeDefined();
    expect(sosRow!.channel).toBe('push');
    expect(sosRow!.payload.context.sosEventId).toBe(sosId);
    expect(sosRow!.payload.context.trigger).toBe('user_tap');
  });

  it('GET /notifications/me returns only my own rows (no cross-user leak)', async () => {
    if (!dbReachable) return;
    const alice = await registerUser('alice');
    const bob = await registerUser('bob');

    // Both users trigger an SOS.
    await app.inject({
      method: 'POST',
      url: '/api/v1/safety/sos',
      headers: { authorization: `Bearer ${alice.accessToken}` },
      payload: { center: REMOTE, trigger: 'alice_tap' },
    });
    await app.inject({
      method: 'POST',
      url: '/api/v1/safety/sos',
      headers: { authorization: `Bearer ${bob.accessToken}` },
      payload: { center: REMOTE, trigger: 'bob_tap' },
    });

    const aliceList = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications/me',
      headers: { authorization: `Bearer ${alice.accessToken}` },
    });
    expect(aliceList.statusCode).toBe(200);
    const body = JSON.parse(aliceList.body) as {
      notifications: Array<{ payload: { context: { trigger?: string } } }>;
    };
    const sosRows = body.notifications.filter((n) => n.payload.context.trigger !== undefined);
    expect(sosRows).toHaveLength(1);
    expect(sosRows[0]!.payload.context.trigger).toBe('alice_tap');
  });

  it('limit query param caps results', async () => {
    if (!dbReachable) return;
    const { accessToken } = await registerUser('limit');

    // Trigger 3 SOS events.
    for (let i = 0; i < 3; i++) {
      await app.inject({
        method: 'POST',
        url: '/api/v1/safety/sos',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { center: REMOTE, trigger: `tap-${i}` },
      });
    }

    const list = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications/me?limit=2',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(list.statusCode).toBe(200);
    const body = JSON.parse(list.body) as { notifications: unknown[] };
    expect(body.notifications).toHaveLength(2);
  });
});
