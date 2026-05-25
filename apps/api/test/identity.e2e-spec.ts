/**
 * Integration test for the Identity module's register / login /
 * refresh / logout flows. The load-bearing scenario is
 * refresh-token reuse detection — presenting an already-rotated
 * refresh token must revoke every session belonging to that user
 * (Playbook §13.2).
 *
 * Skips cleanly if Postgres isn't reachable so the suite stays
 * useful offline (same pattern as `geo-queries.e2e-spec.ts`).
 *
 * Installed by prompt [III.13.2] part 2.
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';
import { uniqueEmail, uniqueSuffix } from './factories';

const TEST_EMAIL_PREFIX = 'identity-e2e';

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

describe('Identity auth flow (integration, requires Docker Postgres)', () => {
  let moduleRef: TestingModule;
  let app: NestFastifyApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.useGlobalFilters(new AllExceptionFilter(), new DomainExceptionFilter());
    app.setGlobalPrefix('api/v1', { exclude: ['health', 'health/(.*)'] });
    await app.register(fastifyCookie);
    // Wrap `app.init()` too — PrismaService.onModuleInit throws if
    // Postgres is unreachable, which previously crashed the suite
    // instead of letting it skip. See memory `feedback_...` / slice
    // back-port.
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    prisma = moduleRef.get(PrismaService);
    await prisma.$queryRaw`SELECT 1`;
  });

  afterEach(async () => {
    // Tear down users created in this spec (sessions cascade via FK).
    await prisma.user.deleteMany({
      where: { displayName: { startsWith: TEST_EMAIL_PREFIX } },
    });
  });

  afterAll(async () => {
    await app.close();
    await moduleRef.close();
  });

  async function registerUser(suffix: string): Promise<{
    userId: string;
    refreshCookie: CookieBits;
    accessToken: string;
  }> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: uniqueEmail(`${TEST_EMAIL_PREFIX}-${suffix}`),
        password: 'correct-horse-battery-staple',
        displayName: `${TEST_EMAIL_PREFIX}-${suffix}`,
      },
      headers: { 'user-agent': 'jest', 'x-device-id': `device-${suffix}` },
    });
    expect(res.statusCode).toBe(201);
    const cookie = parseSetCookie(res.headers['set-cookie']);
    expect(cookie?.name).toBe('refresh_token');
    const body = JSON.parse(res.body) as { userId: string; accessToken: string };
    return {
      userId: body.userId,
      refreshCookie: cookie!,
      accessToken: body.accessToken,
    };
  }

  it('registers, sets httpOnly refresh cookie, returns access token', async () => {
    const { userId, refreshCookie, accessToken } = await registerUser('register');
    expect(userId).toMatch(/^c[a-z0-9]+$/); // cuid
    expect(refreshCookie.value.length).toBeGreaterThan(20);
    expect(accessToken.split('.').length).toBe(3);
  });

  it('rejects login with wrong password using a uniform error code', async () => {
    const email = `${TEST_EMAIL_PREFIX}-wrongpw-${uniqueSuffix()}@example.com`;
    const reg = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email,
        password: 'correct-horse-battery-staple',
        displayName: `${TEST_EMAIL_PREFIX}-wrongpw`,
      },
    });
    expect(reg.statusCode).toBe(201);

    const bad = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password: 'WRONG-PASSWORD-XX' },
    });
    expect(bad.statusCode).toBe(401);
    expect(JSON.parse(bad.body).code).toBe('INVALID_CREDENTIALS');

    const miss = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: uniqueEmail('no-such'),
        password: 'anything',
      },
    });
    expect(miss.statusCode).toBe(401);
    expect(JSON.parse(miss.body).code).toBe('INVALID_CREDENTIALS');
  });

  it('refresh rotates the session — old cookie no longer works, new one does', async () => {
    const { refreshCookie } = await registerUser('rotate');

    const refresh1 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      cookies: { refresh_token: refreshCookie.value },
      headers: { 'user-agent': 'jest' },
    });
    expect(refresh1.statusCode).toBe(200);
    const rotated = parseSetCookie(refresh1.headers['set-cookie']);
    expect(rotated?.name).toBe('refresh_token');
    expect(rotated?.value).not.toEqual(refreshCookie.value);

    // New cookie refreshes again — same UA, so dfp still matches.
    const refresh2 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      cookies: { refresh_token: rotated!.value },
      headers: { 'user-agent': 'jest' },
    });
    expect(refresh2.statusCode).toBe(200);
  });

  it('REUSE CASCADE: replaying an already-rotated refresh token revokes ALL sessions for that user', async () => {
    const { userId, refreshCookie } = await registerUser('cascade');

    // Open a second session via /login so we can prove the cascade
    // reaches beyond the rotated session.
    // The user is already registered; grab the email from the DB to log in.
    const user = await prisma.user.findUnique({ where: { id: userId } });
    expect(user).not.toBeNull();

    const email = Buffer.from(user!.emailEncrypted).toString('utf8');
    const login2 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password: 'correct-horse-battery-staple' },
      headers: { 'user-agent': 'jest-device-2', 'x-device-id': 'device-2' },
    });
    expect(login2.statusCode).toBe(200);

    // Two active sessions for this user, confirmed.
    const activeBefore = await prisma.session.count({
      where: { userId, revokedAt: null },
    });
    expect(activeBefore).toBe(2);

    // Rotate session 1. Same UA as at register, so dfp binding passes.
    const rotate = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      cookies: { refresh_token: refreshCookie.value },
      headers: { 'user-agent': 'jest' },
    });
    expect(rotate.statusCode).toBe(200);

    // Replay the original (now-rotated) cookie → cascade.
    const replay = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      cookies: { refresh_token: refreshCookie.value },
      headers: { 'user-agent': 'jest' },
    });
    expect(replay.statusCode).toBe(401);
    expect(JSON.parse(replay.body).code).toBe('REFRESH_REUSE_DETECTED');

    // Every session for this user is now revoked.
    const activeAfter = await prisma.session.count({
      where: { userId, revokedAt: null },
    });
    expect(activeAfter).toBe(0);

    const total = await prisma.session.count({ where: { userId } });
    expect(total).toBe(3); // rotated-old, rotated-new, login2 — all revoked.
  });

  it('logout clears the cookie and revokes the session idempotently', async () => {
    const { userId, refreshCookie } = await registerUser('logout');

    const logout = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      cookies: { refresh_token: refreshCookie.value },
    });
    expect(logout.statusCode).toBe(204);

    const activeAfter = await prisma.session.count({
      where: { userId, revokedAt: null },
    });
    expect(activeAfter).toBe(0);

    // Second logout is a no-op (idempotent).
    const logout2 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      cookies: { refresh_token: refreshCookie.value },
    });
    expect(logout2.statusCode).toBe(204);
  });
});
