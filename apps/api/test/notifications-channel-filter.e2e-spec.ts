/**
 * Integration tests for the optional `?channel=push|email|sms`
 * filter on `GET /api/v1/notifications/me` ([IV.18.12.13]).
 *
 * The fixture leans on already-wired event handlers:
 *   - register      → SessionIssued      → email row
 *   - POST /safety/sos → SosTriggered    → push row
 * which lets the test produce both channels for a single user
 * without seeding NotificationLog directly.
 *
 * Behavior contract:
 *   - no `channel` param → returns the union (regression).
 *   - `?channel=push`     → only push rows.
 *   - `?channel=email`    → only email rows.
 *   - `?channel=bogus`    → 400 VALIDATION_FAILED.
 *
 * Installed by prompt [IV.18.12.13].
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

const TEST_PREFIX = 'notif-channel-filter-e2e';
// Suite-local coord (memory/feedback_unique_test_coords.md).
const REMOTE = { lat: 13.3344, lng: -29.5566 };

interface NotificationItem {
  id: string;
  channel: string;
  templateId: string;
  status: string;
  read: boolean;
  payload: Readonly<Record<string, unknown>>;
}
interface ListResp {
  notifications: NotificationItem[];
}

describe('GET /notifications/me?channel= (integration, requires Docker Postgres)', () => {
  let moduleRef: TestingModule;
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let sender: LoggingNotificationSender;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.useGlobalFilters(new AllExceptionFilter(), new DomainExceptionFilter());
    app.setGlobalPrefix('api/v1', { exclude: ['health', 'health/(.*)'] });
    await app.register(fastifyCookie);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    prisma = moduleRef.get(PrismaService);
    sender = moduleRef.get(LoggingNotificationSender);
    await prisma.$queryRaw`SELECT 1`;
  });

  afterEach(async () => {
    sender.drainSent();
    await prisma.user.deleteMany({
      where: { displayName: { startsWith: TEST_PREFIX } },
    });
  });

  afterAll(async () => {
    await app.close();
    await moduleRef.close();
  });

  async function registerAndSos(suffix: string): Promise<{ accessToken: string }> {
    const reg = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: uniqueEmail(`${TEST_PREFIX}-${suffix}`),
        password: 'correct-horse-battery-staple',
        displayName: `${TEST_PREFIX}-${suffix}`,
      },
    });
    expect(reg.statusCode).toBe(201);
    const accessToken = (JSON.parse(reg.body) as { accessToken: string }).accessToken;
    // Trigger an SOS to produce a push row (register already produced an email row).
    const sos = await app.inject({
      method: 'POST',
      url: '/api/v1/safety/sos',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { center: REMOTE, trigger: 'channel-test' },
    });
    expect(sos.statusCode).toBe(201);
    return { accessToken };
  }

  async function list(token: string, query = ''): Promise<ListResp> {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/notifications/me${query}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    return JSON.parse(res.body) as ListResp;
  }

  it('no channel param → returns the union of channels (regression)', async () => {
    const { accessToken } = await registerAndSos('union');
    const body = await list(accessToken);
    const channels = new Set(body.notifications.map((n) => n.channel));
    // Both channels present without filter.
    expect(channels.has('email')).toBe(true);
    expect(channels.has('push')).toBe(true);
  });

  it('?channel=push → returns only push rows', async () => {
    const { accessToken } = await registerAndSos('push');
    const body = await list(accessToken, '?channel=push');
    expect(body.notifications.length).toBeGreaterThanOrEqual(1);
    for (const n of body.notifications) expect(n.channel).toBe('push');
  });

  it('?channel=email → returns only email rows', async () => {
    const { accessToken } = await registerAndSos('email');
    const body = await list(accessToken, '?channel=email');
    expect(body.notifications.length).toBeGreaterThanOrEqual(1);
    for (const n of body.notifications) expect(n.channel).toBe('email');
  });

  it('?channel=bogus → 400 VALIDATION_FAILED', async () => {
    const { accessToken } = await registerAndSos('bad');
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications/me?channel=bogus',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).code).toBe('VALIDATION_FAILED');
  });

  it('?channel=sms → returns empty list (no sms rows in fixture)', async () => {
    const { accessToken } = await registerAndSos('sms');
    const body = await list(accessToken, '?channel=sms');
    expect(body.notifications).toEqual([]);
  });
});
