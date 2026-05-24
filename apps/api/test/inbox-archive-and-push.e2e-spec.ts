/**
 * V.UX.26 — integration tests for the inbox archive + per-category
 * prefs + Web Push subscription + weekly-digest surfaces.
 *
 *   1. POST /notifications/:id/archive without bearer → 401.
 *   2. Archive happy path → 204; default lister no longer returns
 *      the row; ?includeArchived=true does.
 *   3. PATCH /notifications/preferences disables 'social'; sender
 *      writes a `suppressed` row instead of `delivered` for a
 *      review-category template.
 *   4. POST /notifications/push/subscribe stores the row;
 *      DELETE removes it.
 *   5. SendWeeklyDigestUseCase (forced) sends one digest per
 *      eligible user; lastDigestSentAt is advanced; second call
 *      within the week is a no-op.
 *   6. PATCH /notifications/preferences with categoriesDisabled =
 *      ['digest'] removes the user from the digest sweep.
 *
 * Installed by prompt [V.UX.26].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';
import { LoggingNotificationSender } from '../src/modules/notifications/infrastructure/logging-notification-sender';
import { SendWeeklyDigestUseCase } from '../src/modules/notifications/application/send-weekly-digest.use-case';
import { uniqueEmail, uniqueSuffix } from './factories';

const TEST_PREFIX = 'inbox-archive-push-e2e';

interface RegisterRes {
  userId: string;
  accessToken: string;
}

interface NotificationRow {
  id: string;
  status: string;
  archivedAt: string | null;
  templateId: string;
}
interface ListRes {
  notifications: NotificationRow[];
}
interface PrefsRes {
  push: boolean;
  email: boolean;
  sms: boolean;
  categoriesDisabled: string[];
}

describe('V.UX.26 inbox archive + per-category prefs + push (integration, requires Docker Postgres)', () => {
  let moduleRef: TestingModule;
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let sender: LoggingNotificationSender;
  let digest: SendWeeklyDigestUseCase;
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
      digest = moduleRef.get(SendWeeklyDigestUseCase);
      await prisma.$queryRaw`SELECT 1`;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // eslint-disable-next-line no-console
      console.warn(`inbox-archive-push test: DB not reachable (${message}). Skipping.`);
      dbReachable = false;
    }
  });

  afterEach(async () => {
    if (!dbReachable) return;
    await prisma.pushSubscription.deleteMany({
      where: { user: { displayName: { startsWith: TEST_PREFIX } } },
    });
    await prisma.notificationLog.deleteMany({
      where: { user: { displayName: { startsWith: TEST_PREFIX } } },
    });
    await prisma.notificationPreference.deleteMany({
      where: { user: { displayName: { startsWith: TEST_PREFIX } } },
    });
    await prisma.user.deleteMany({ where: { displayName: { startsWith: TEST_PREFIX } } });
  });

  afterAll(async () => {
    if (dbReachable) await app.close();
    await moduleRef.close();
  });

  async function registerAndGetToken(suffix: string): Promise<RegisterRes> {
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
    return JSON.parse(res.body) as RegisterRes;
  }

  async function seedNotification(
    userId: string,
    templateId: string,
    channel: 'push' | 'email' | 'sms' = 'email',
  ): Promise<string> {
    const row = await prisma.notificationLog.create({
      data: {
        userId,
        channel,
        templateId,
        status: 'delivered',
        payload: { subject: `${TEST_PREFIX}-subject`, body: `${TEST_PREFIX}-body` },
        deliveredAt: new Date(),
      },
    });
    return row.id;
  }

  it('POST /notifications/:id/archive without bearer → 401', async () => {
    if (!dbReachable) return;
    const u = await registerAndGetToken('archive-anon');
    const id = await seedNotification(u.userId, 'session_issued');
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/notifications/${id}/archive`,
    });
    expect(res.statusCode).toBe(401);
  });

  it('Archive removes row from default lister; ?includeArchived=true returns it', async () => {
    if (!dbReachable) return;
    const u = await registerAndGetToken('archive-happy');
    const id = await seedNotification(u.userId, 'session_issued');

    const before = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications/me',
      headers: { authorization: `Bearer ${u.accessToken}` },
    });
    expect(
      (JSON.parse(before.body) as ListRes).notifications.find((n) => n.id === id),
    ).toBeDefined();

    const archive = await app.inject({
      method: 'POST',
      url: `/api/v1/notifications/${id}/archive`,
      headers: { authorization: `Bearer ${u.accessToken}` },
    });
    expect(archive.statusCode).toBe(204);

    const after = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications/me',
      headers: { authorization: `Bearer ${u.accessToken}` },
    });
    expect(
      (JSON.parse(after.body) as ListRes).notifications.find((n) => n.id === id),
    ).toBeUndefined();

    const all = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications/me?includeArchived=true',
      headers: { authorization: `Bearer ${u.accessToken}` },
    });
    const row = (JSON.parse(all.body) as ListRes).notifications.find((n) => n.id === id);
    expect(row).toBeDefined();
    expect(row?.archivedAt).not.toBeNull();
  });

  it('Per-category opt-out makes the sender write a suppressed row', async () => {
    if (!dbReachable) return;
    const u = await registerAndGetToken('prefs-cat');

    const patch = await app.inject({
      method: 'PATCH',
      url: '/api/v1/notifications/preferences',
      headers: { authorization: `Bearer ${u.accessToken}` },
      payload: { categoriesDisabled: ['social'] },
    });
    expect(patch.statusCode).toBe(200);
    expect((JSON.parse(patch.body) as PrefsRes).categoriesDisabled).toContain('social');

    await sender.send({
      userId: u.userId,
      channel: 'push',
      templateKey: 'review_response',
      subject: `${TEST_PREFIX}-suppressed-subject`,
      body: `${TEST_PREFIX}-suppressed-body`,
      context: {},
    });

    const list = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications/me',
      headers: { authorization: `Bearer ${u.accessToken}` },
    });
    const rows = (JSON.parse(list.body) as ListRes).notifications;
    const suppressed = rows.find((r) => r.templateId === 'review_response');
    expect(suppressed).toBeDefined();
    expect(suppressed?.status).toBe('suppressed');
  });

  it('Push subscribe + unsubscribe round-trip', async () => {
    if (!dbReachable) return;
    const u = await registerAndGetToken('push-rt');
    const endpoint = `https://example.com/push/${TEST_PREFIX}-${uniqueSuffix()}`;

    const sub = await app.inject({
      method: 'POST',
      url: '/api/v1/notifications/push/subscribe',
      headers: { authorization: `Bearer ${u.accessToken}` },
      payload: {
        endpoint,
        keys: { p256dh: 'aaaaaaaaaaaa', auth: 'bbbbbbbb' },
      },
    });
    expect(sub.statusCode).toBe(201);

    const stored = await prisma.pushSubscription.findUnique({ where: { endpoint } });
    expect(stored).not.toBeNull();
    expect(stored?.userId).toBe(u.userId);

    const unsub = await app.inject({
      method: 'DELETE',
      url: '/api/v1/notifications/push/subscribe',
      headers: { authorization: `Bearer ${u.accessToken}` },
      payload: { endpoint },
    });
    expect(unsub.statusCode).toBe(204);

    const reaped = await prisma.pushSubscription.findUnique({ where: { endpoint } });
    expect(reaped).toBeNull();
  });

  it('Weekly digest sends to email-eligible users + advances lastDigestSentAt', async () => {
    if (!dbReachable) return;
    const u = await registerAndGetToken('digest-on');
    // Seed prefs row so listEligibleForDigest finds the user.
    await prisma.notificationPreference.upsert({
      where: { userId: u.userId },
      create: { userId: u.userId, email: true, categoriesDisabled: [] },
      update: { email: true, categoriesDisabled: [] },
    });

    const before = sender.peekSent().length;
    const result = await digest.execute(new Date(), true);
    expect(result.visited).toBeGreaterThanOrEqual(1);
    expect(result.sent).toBeGreaterThanOrEqual(1);
    expect(sender.peekSent().length).toBeGreaterThan(before);

    const prefRow = await prisma.notificationPreference.findUnique({
      where: { userId: u.userId },
    });
    expect(prefRow?.lastDigestSentAt).not.toBeNull();

    // Second call within the week is a no-op for this user.
    const second = await digest.execute(new Date(), true);
    // We can't assert sent === 0 globally (other test users could
    // be eligible too), but for this user lastDigestSentAt must
    // not have advanced enough to trigger another send. We assert
    // by counting the additional rows in NotificationLog.
    const digestRows = await prisma.notificationLog.count({
      where: { userId: u.userId, templateId: 'weekly_digest' },
    });
    expect(digestRows).toBe(1);
    expect(second.visited).toBeGreaterThanOrEqual(1);
  });

  it('categoriesDisabled including digest removes the user from the digest sweep', async () => {
    if (!dbReachable) return;
    const u = await registerAndGetToken('digest-off');
    await prisma.notificationPreference.upsert({
      where: { userId: u.userId },
      create: {
        userId: u.userId,
        email: true,
        categoriesDisabled: ['digest'],
      },
      update: { email: true, categoriesDisabled: ['digest'] },
    });

    await digest.execute(new Date(), true);

    const digestRows = await prisma.notificationLog.count({
      where: { userId: u.userId, templateId: 'weekly_digest' },
    });
    expect(digestRows).toBe(0);
  });
});
