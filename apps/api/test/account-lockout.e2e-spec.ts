/**
 * Integration tests for account lockout after N failed logins
 * ([IV.18.2.6]). Uses Redis (same container the rate-limiter uses).
 *
 * Verifies:
 *   1. After MAX_FAILED_LOGIN_ATTEMPTS wrong passwords, the next
 *      /login returns 429 ACCOUNT_LOCKED with a Retry-After header.
 *   2. A successful login resets the counter — subsequent wrong
 *      attempts start from 0 again.
 *   3. Lockout applies even when the wrong attempts hit a
 *      non-existent email (prevents enumeration via timing).
 *   4. Lockout applies across the MFA gate — an attacker with a
 *      leaked password can't brute-force TOTP codes unbounded.
 *
 * Skips cleanly when Postgres or Redis aren't reachable.
 *
 * Installed by prompt [IV.18.2.6].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';
import { MAX_FAILED_LOGIN_ATTEMPTS } from '../src/modules/identity/application/login.use-case';
import {
  FAILED_LOGIN_COUNTER,
  type FailedLoginCounter,
} from '../src/modules/identity/application/ports/failed-login-counter';
import { hashEmail } from '../src/common/crypto/email-hash';
import { uniqueEmail, uniqueSuffix } from './factories';

const TEST_PREFIX = 'lockout-e2e';

describe('Account lockout (integration, requires Docker Postgres + Redis)', () => {
  let moduleRef: TestingModule;
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let counter: FailedLoginCounter;
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
      counter = moduleRef.get<FailedLoginCounter>(FAILED_LOGIN_COUNTER);
      await prisma.$queryRaw`SELECT 1`;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // eslint-disable-next-line no-console
      console.warn(`lockout test: infra not reachable (${message}). Skipping.`);
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

  async function registerUser(
    suffix: string,
    password = 'correct-horse-battery-staple',
  ): Promise<{ email: string; password: string; userId: string }> {
    const email = uniqueEmail(`${TEST_PREFIX}-${suffix}`);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email, password, displayName: `${TEST_PREFIX}-${suffix}` },
      headers: { 'user-agent': 'lockout-ua' },
    });
    expect(res.statusCode).toBe(201);
    // Counter must start fresh — even though register doesn't touch
    // it, a prior test run might have left stale state.
    await counter.reset(hashEmail(email));
    const body = JSON.parse(res.body) as { userId: string };
    return { email, password, userId: body.userId };
  }

  async function tryLogin(email: string, password: string): Promise<number> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password },
      headers: { 'user-agent': 'lockout-ua' },
    });
    return res.statusCode;
  }

  it(`${MAX_FAILED_LOGIN_ATTEMPTS + 1}th login attempt returns 429 ACCOUNT_LOCKED with Retry-After`, async () => {
    const { email } = await registerUser('trip-limit');

    // N wrong attempts — each returns 401 INVALID_CREDENTIALS.
    for (let i = 0; i < MAX_FAILED_LOGIN_ATTEMPTS; i++) {
      expect(await tryLogin(email, 'WRONG-PW-XXXXX')).toBe(401);
    }

    // (N+1)th attempt — locked out even though we're using the
    // same wrong password; the counter already hit the cap.
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password: 'WRONG-PW-XXXXX' },
      headers: { 'user-agent': 'lockout-ua' },
    });
    expect(res.statusCode).toBe(429);
    expect(JSON.parse(res.body).code).toBe('ACCOUNT_LOCKED');
    // Retry-After is in whole seconds (RFC 9110 §10.2.3).
    const retryAfter = res.headers['retry-after'];
    expect(typeof retryAfter).toBe('string');
    expect(Number(retryAfter)).toBeGreaterThan(0);
    expect(Number(retryAfter)).toBeLessThanOrEqual(15 * 60);

    // Even with the RIGHT password, still locked.
    const locked = await tryLogin(email, 'correct-horse-battery-staple');
    expect(locked).toBe(429);
  }, 30_000);

  it('successful login resets the counter', async () => {
    const { email, password } = await registerUser('reset');

    // Burn 4 failures (one short of the cap).
    for (let i = 0; i < MAX_FAILED_LOGIN_ATTEMPTS - 1; i++) {
      expect(await tryLogin(email, 'WRONG-PW-XXXXX')).toBe(401);
    }
    // A correct login succeeds AND resets.
    expect(await tryLogin(email, password)).toBe(200);

    // Post-success, 4 more wrong tries stay below the cap.
    for (let i = 0; i < MAX_FAILED_LOGIN_ATTEMPTS - 1; i++) {
      expect(await tryLogin(email, 'WRONG-PW-XXXXX')).toBe(401);
    }
  });

  it('lockout applies to unknown emails too (prevents timing enumeration)', async () => {
    const email = `${TEST_PREFIX}-ghost-${uniqueSuffix()}@example.com`;
    // Fresh counter — test isolation.
    await counter.reset(hashEmail(email));

    for (let i = 0; i < MAX_FAILED_LOGIN_ATTEMPTS; i++) {
      expect(await tryLogin(email, 'anything')).toBe(401);
    }
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password: 'anything' },
      headers: { 'user-agent': 'lockout-ua' },
    });
    expect(res.statusCode).toBe(429);
    expect(JSON.parse(res.body).code).toBe('ACCOUNT_LOCKED');
  });

  it('counter increments even on INVALID_MFA — attacker with leaked password still gets locked', async () => {
    const { email, password, userId } = await registerUser('mfa-fail');

    // Enable MFA via the counter-testing shortcut: flip the DB
    // directly. Full enrolment is exercised by mfa.e2e-spec.ts;
    // here we just need `mfaEnabled: true` + a secret.
    await prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: true, mfaSecret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP' },
    });

    // 5 attempts with correct password but wrong TOTP — each is an
    // INVALID_MFA failure.
    for (let i = 0; i < MAX_FAILED_LOGIN_ATTEMPTS; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email, password, mfaCode: '000000' },
        headers: { 'user-agent': 'lockout-ua' },
      });
      expect(res.statusCode).toBe(401);
      expect(JSON.parse(res.body).code).toBe('INVALID_MFA');
    }

    // 6th attempt — locked.
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password, mfaCode: '000000' },
      headers: { 'user-agent': 'lockout-ua' },
    });
    expect(res.statusCode).toBe(429);
    expect(JSON.parse(res.body).code).toBe('ACCOUNT_LOCKED');
  });
});
