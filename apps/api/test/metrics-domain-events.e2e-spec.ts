/**
 * Integration test for `domain_events_total` Prometheus counter
 * ([IV.18.10.7]).
 *
 * The MetricsRecordingEventBus decorator wraps every publish to
 * `inc()` the counter, then delegates to the underlying bus. Two
 * assertions:
 *
 *   1. After registering a user (which fires
 *      `Identity.SessionIssued`), `/metrics` shows
 *      `domain_events_total{event="Identity.SessionIssued"}` >= 1.
 *   2. The counter increases monotonically across additional
 *      registrations.
 *
 * Installed by prompt [IV.18.10.7].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';

const TEST_PREFIX = 'metrics-domain-events-e2e';

describe('domain_events_total counter (integration, requires Docker Postgres)', () => {
  let moduleRef: TestingModule;
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let infraReachable = true;

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
      console.warn(`metrics-domain-events test: infra not reachable (${message}). Skipping.`);
      infraReachable = false;
    }
  });

  afterEach(async () => {
    if (!infraReachable) return;
    await prisma.user.deleteMany({
      where: { displayName: { startsWith: TEST_PREFIX } },
    });
  });

  afterAll(async () => {
    if (infraReachable) await app.close();
    await moduleRef.close();
  });

  async function registerUser(suffix: string): Promise<void> {
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
  }

  async function scrapeCounter(eventName: string): Promise<number> {
    const res = await app.inject({ method: 'GET', url: '/metrics' });
    expect(res.statusCode).toBe(200);
    const re = new RegExp(
      `^domain_events_total\\{event="${eventName.replace(/\./g, '\\.')}"\\}\\s+([\\d.]+)`,
      'm',
    );
    const m = res.body.match(re);
    return m && m[1] !== undefined ? Number(m[1]) : 0;
  }

  it('register triggers Identity.SessionIssued → counter increments', async () => {
    if (!infraReachable) return;
    const before = await scrapeCounter('Identity.SessionIssued');
    await registerUser('first');
    const after = await scrapeCounter('Identity.SessionIssued');
    expect(after).toBeGreaterThan(before);
  });

  it('counter is monotonic across additional events', async () => {
    if (!infraReachable) return;
    const before = await scrapeCounter('Identity.SessionIssued');
    await registerUser('second-1');
    await registerUser('second-2');
    const after = await scrapeCounter('Identity.SessionIssued');
    expect(after - before).toBeGreaterThanOrEqual(2);
  });

  it('counter is exposed with the expected label format', async () => {
    if (!infraReachable) return;
    await registerUser('format');
    const res = await app.inject({ method: 'GET', url: '/metrics' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('# HELP domain_events_total');
    expect(res.body).toMatch(/domain_events_total\{event="[A-Za-z][\w.]*"\}\s+\d/);
  });
});
