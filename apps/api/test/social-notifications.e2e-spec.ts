/**
 * Integration tests for Phase 5 (J6) — social notifications.
 *
 * The in-memory event bus dispatches synchronously (publish awaits
 * every handler), so by the time the follow / comment API call
 * returns, the notification row already exists — no polling needed.
 *
 *   1. Following a user → followee gets a `user_followed` row.
 *   2. A repeat-follow does NOT create a second row (idempotent).
 *   3. Commenting on a published trip → trip author gets a
 *      `trip_commented` row.
 *   4. The author commenting on their own trip → no notification.
 *
 * Installed by prompt [J6].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';

const TEST_PREFIX = 'social-notif-e2e';
const COORD = { lat: 13.7563, lng: 100.5018 };

interface NotifRow {
  templateId: string;
}

describe('Social notifications (integration, requires Docker Postgres)', () => {
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
      console.warn(`social-notif test: DB not reachable (${message}). Skipping.`);
      dbReachable = false;
    }
  });

  afterEach(async () => {
    if (!dbReachable) return;
    await prisma.user.deleteMany({ where: { displayName: { startsWith: TEST_PREFIX } } });
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
        email: `${TEST_PREFIX}-${suffix}-${Date.now()}-${Math.random()}@example.com`,
        password: 'correct-horse-battery-staple',
        displayName: `${TEST_PREFIX}-${suffix}`,
      },
    });
    expect(res.statusCode).toBe(201);
    return JSON.parse(res.body) as { userId: string; accessToken: string };
  }

  async function follow(token: string, targetId: string): Promise<number> {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/users/${targetId}/follow`,
      headers: { authorization: `Bearer ${token}` },
    });
    return res.statusCode;
  }

  async function notificationsOf(token: string): Promise<NotifRow[]> {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications/me',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    return (JSON.parse(res.body) as { notifications: NotifRow[] }).notifications;
  }

  async function publishedTrip(token: string): Promise<string> {
    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/trips',
      headers: { authorization: `Bearer ${token}` },
      payload: { title: `${TEST_PREFIX}-trip`, center: COORD, radiusKm: 5 },
    });
    expect(create.statusCode).toBe(201);
    const tripId = (JSON.parse(create.body) as { id: string }).id;
    await prisma.trip.update({
      where: { id: tripId },
      data: { endsOn: new Date(Date.now() - 7 * 86_400_000) },
    });
    const pub = await app.inject({
      method: 'POST',
      url: `/api/v1/feed/trips/${tripId}/publish`,
      headers: { authorization: `Bearer ${token}` },
      payload: { visibility: 'PUBLIC' },
    });
    expect(pub.statusCode).toBe(200);
    return tripId;
  }

  it('following a user notifies the followee', async () => {
    if (!dbReachable) return;
    const fan = await registerUser('fan');
    const star = await registerUser('star');
    expect(await follow(fan.accessToken, star.userId)).toBe(200);

    const rows = await notificationsOf(star.accessToken);
    expect(rows.some((n) => n.templateId === 'user_followed')).toBe(true);
  });

  it('a repeat-follow does not create a second notification', async () => {
    if (!dbReachable) return;
    const fan = await registerUser('fan2');
    const star = await registerUser('star2');
    await follow(fan.accessToken, star.userId);
    await follow(fan.accessToken, star.userId); // repeat — idempotent

    const rows = await notificationsOf(star.accessToken);
    expect(rows.filter((n) => n.templateId === 'user_followed')).toHaveLength(1);
  });

  it('commenting on a published trip notifies the trip author', async () => {
    if (!dbReachable) return;
    const owner = await registerUser('owner');
    const commenter = await registerUser('commenter');
    const tripId = await publishedTrip(owner.accessToken);

    const posted = await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${tripId}/comments`,
      headers: { authorization: `Bearer ${commenter.accessToken}` },
      payload: { body: `${TEST_PREFIX} nice one` },
    });
    expect(posted.statusCode).toBe(201);

    const rows = await notificationsOf(owner.accessToken);
    expect(rows.some((n) => n.templateId === 'trip_commented')).toBe(true);
  });

  it('the author commenting on their own trip → no notification', async () => {
    if (!dbReachable) return;
    const owner = await registerUser('solo');
    const tripId = await publishedTrip(owner.accessToken);

    const posted = await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${tripId}/comments`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: { body: `${TEST_PREFIX} talking to myself` },
    });
    expect(posted.statusCode).toBe(201);

    const rows = await notificationsOf(owner.accessToken);
    expect(rows.some((n) => n.templateId === 'trip_commented')).toBe(false);
  });
});
