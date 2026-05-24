/**
 * Integration tests for [III.13.2] part 3 session hardening:
 *   - Concurrency cap: an 11th login revokes the oldest active
 *     session. The newest 10 stay live.
 *   - Device-fingerprint binding: /refresh from a different UA than
 *     issuance cascades — every session for that user revoked.
 *
 * Skips cleanly when Postgres isn't reachable.
 *
 * Installed by prompt [III.13.2] part 3.
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';
import { MAX_SESSIONS_PER_USER } from '../src/modules/identity/application/issue-session.use-case';
import { uniqueSuffix } from './factories';

const TEST_PREFIX = 'session-hardening-e2e';

interface CookieBits {
  readonly name: string;
  readonly value: string;
}

function parseSetCookie(header: string | string[] | undefined): CookieBits | null {
  if (!header) return null;
  const raw = Array.isArray(header) ? header.join(',') : header;
  const match = /^([^=]+)=([^;]+)/.exec(raw);
  if (!match) return null;
  return { name: match[1]!, value: match[2]! };
}

describe('Session hardening (integration, requires Docker Postgres)', () => {
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
      console.warn(`session-hardening test: DB not reachable (${message}). Skipping.`);
      dbReachable = false;
    }
  });

  afterEach(async () => {
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

  it(`concurrency cap — the ${MAX_SESSIONS_PER_USER + 1}th login revokes the oldest, newest ${MAX_SESSIONS_PER_USER} stay live`, async () => {
    const email = `${TEST_PREFIX}-cap-${uniqueSuffix()}@example.com`;
    const password = 'correct-horse-battery-staple';

    // First session = register.
    const reg = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email, password, displayName: `${TEST_PREFIX}-cap` },
      headers: { 'user-agent': 'cap-ua' },
    });
    expect(reg.statusCode).toBe(201);
    const userId = (JSON.parse(reg.body) as { userId: string }).userId;

    // Log in (MAX - 1) more times to reach exactly MAX active sessions.
    for (let i = 1; i < MAX_SESSIONS_PER_USER; i++) {
      const login = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email, password },
        headers: { 'user-agent': 'cap-ua' },
      });
      expect(login.statusCode).toBe(200);
    }
    const activeAtCap = await prisma.session.count({
      where: { userId, revokedAt: null },
    });
    expect(activeAtCap).toBe(MAX_SESSIONS_PER_USER);

    // One more login → cap enforced, oldest revoked.
    const overflow = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password },
      headers: { 'user-agent': 'cap-ua' },
    });
    expect(overflow.statusCode).toBe(200);

    const activeAfter = await prisma.session.count({
      where: { userId, revokedAt: null },
    });
    expect(activeAfter).toBe(MAX_SESSIONS_PER_USER);

    const total = await prisma.session.count({ where: { userId } });
    expect(total).toBe(MAX_SESSIONS_PER_USER + 1); // 1 trimmed, 10 live.

    // And the trimmed row is the one with the earliest `issuedAt`.
    const oldest = await prisma.session.findFirst({
      where: { userId },
      orderBy: { issuedAt: 'asc' },
    });
    expect(oldest?.revokedAt).not.toBeNull();
  }, 15_000);

  it('device-fingerprint binding — /refresh from a different UA cascades and revokes ALL sessions', async () => {
    const email = `${TEST_PREFIX}-dfp-${uniqueSuffix()}@example.com`;
    const password = 'correct-horse-battery-staple';

    const reg = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email, password, displayName: `${TEST_PREFIX}-dfp` },
      headers: { 'user-agent': 'mobile-app-1.0' },
    });
    expect(reg.statusCode).toBe(201);
    const userId = (JSON.parse(reg.body) as { userId: string }).userId;
    const refreshCookie = parseSetCookie(reg.headers['set-cookie']);
    expect(refreshCookie?.name).toBe('refresh_token');

    // Second session from the SAME UA — proves cascade reaches
    // other sessions, not just the one presenting the bad dfp.
    const login2 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password },
      headers: { 'user-agent': 'mobile-app-1.0' },
    });
    expect(login2.statusCode).toBe(200);

    const activeBefore = await prisma.session.count({
      where: { userId, revokedAt: null },
    });
    expect(activeBefore).toBe(2);

    // Attacker replays the refresh cookie from a different UA.
    const attack = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      cookies: { refresh_token: refreshCookie!.value },
      headers: { 'user-agent': 'curl/8.0' }, // Wrong UA → dfp mismatch.
    });
    expect(attack.statusCode).toBe(401);
    expect(JSON.parse(attack.body).code).toBe('REFRESH_DFP_MISMATCH');

    const activeAfter = await prisma.session.count({
      where: { userId, revokedAt: null },
    });
    expect(activeAfter).toBe(0);
  });

  it('device-fingerprint binding — same UA across register + refresh still works normally', async () => {
    const email = `${TEST_PREFIX}-dfp-ok-${uniqueSuffix()}@example.com`;
    const reg = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email,
        password: 'correct-horse-battery-staple',
        displayName: `${TEST_PREFIX}-dfp-ok`,
      },
      headers: { 'user-agent': 'chrome-116.0' },
    });
    expect(reg.statusCode).toBe(201);
    const refreshCookie = parseSetCookie(reg.headers['set-cookie']);

    const refresh = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      cookies: { refresh_token: refreshCookie!.value },
      headers: { 'user-agent': 'chrome-116.0' },
    });
    expect(refresh.statusCode).toBe(200);
  });
});
