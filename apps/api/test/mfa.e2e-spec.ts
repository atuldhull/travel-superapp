/**
 * Integration tests for [III.13.2] part 4 TOTP MFA:
 *   - /auth/mfa/setup issues a base32 secret + otpauth URI.
 *   - /auth/mfa/verify flips `mfaEnabled` on a correct code.
 *   - /auth/login without a code after enrollment returns
 *     401 `MFA_REQUIRED`.
 *   - /auth/login with a valid code returns 200 + session.
 *   - /auth/login with a wrong code returns 401 `INVALID_MFA`.
 *   - /auth/mfa/disable rejects a wrong code + clears `mfaEnabled`
 *     on a correct one.
 *
 * The test generates real TOTP codes from the issued secret so the
 * RFC 6238 path is end-to-end exercised against `speakeasy` (same
 * library an authenticator app uses).
 *
 * Installed by prompt [III.13.2] part 4.
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import speakeasy from 'speakeasy';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';

const TEST_PREFIX = 'mfa-e2e';

function totp(secret: string): string {
  return speakeasy.totp({ secret, encoding: 'base32' });
}

describe('MFA lifecycle (integration, requires Docker Postgres)', () => {
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
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    prisma = moduleRef.get(PrismaService);
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // eslint-disable-next-line no-console
      console.warn(`mfa test: DB not reachable (${message}). Skipping.`);
      dbReachable = false;
    }
  });

  afterEach(async () => {
    if (!dbReachable) return;
    await prisma.user.deleteMany({
      where: { displayName: { startsWith: TEST_PREFIX } },
    });
  });

  afterAll(async () => {
    await app.close();
    await moduleRef.close();
  });

  async function registerUser(suffix: string): Promise<{
    email: string;
    password: string;
    userId: string;
    accessToken: string;
  }> {
    const email = `${TEST_PREFIX}-${suffix}-${Date.now()}@example.com`;
    const password = 'correct-horse-battery-staple';
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email, password, displayName: `${TEST_PREFIX}-${suffix}` },
      headers: { 'user-agent': 'mfa-ua' },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body) as { userId: string; accessToken: string };
    return { email, password, userId: body.userId, accessToken: body.accessToken };
  }

  it('full enrollment: setup → verify → enabled; login without code → MFA_REQUIRED; with code → 200', async () => {
    if (!dbReachable) return;
    const { email, password, userId, accessToken } = await registerUser('enrol');

    // 1. Setup issues a secret.
    const setup = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/mfa/setup',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(setup.statusCode).toBe(200);
    const { base32, otpauthUri } = JSON.parse(setup.body) as {
      base32: string;
      otpauthUri: string;
    };
    expect(base32).toMatch(/^[A-Z2-7]{20,}$/);
    expect(otpauthUri).toMatch(/^otpauth:\/\/totp\//);

    // Still disabled until we verify.
    const midState = await prisma.user.findUnique({ where: { id: userId } });
    expect(midState?.mfaEnabled).toBe(false);
    expect(midState?.mfaSecret).toBeTruthy();

    // 2. Verify with a valid code — flip `mfaEnabled`.
    const verify = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/mfa/verify',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { code: totp(base32) },
    });
    expect(verify.statusCode).toBe(200);
    const verifyBody = JSON.parse(verify.body) as { backupCodes: string[] | null };
    expect(verifyBody.backupCodes).toBeTruthy();
    expect(verifyBody.backupCodes).toHaveLength(10);
    const after = await prisma.user.findUnique({ where: { id: userId } });
    expect(after?.mfaEnabled).toBe(true);

    // 3. Login without a code → 401 MFA_REQUIRED.
    const loginNoCode = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password },
      headers: { 'user-agent': 'mfa-ua' },
    });
    expect(loginNoCode.statusCode).toBe(401);
    expect(JSON.parse(loginNoCode.body).code).toBe('MFA_REQUIRED');

    // 4. Login with a bogus code → 401 INVALID_MFA.
    const loginBadCode = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password, mfaCode: '000000' },
      headers: { 'user-agent': 'mfa-ua' },
    });
    expect(loginBadCode.statusCode).toBe(401);
    expect(JSON.parse(loginBadCode.body).code).toBe('INVALID_MFA');

    // 5. Login with a real code → 200.
    const loginOk = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password, mfaCode: totp(base32) },
      headers: { 'user-agent': 'mfa-ua' },
    });
    expect(loginOk.statusCode).toBe(200);
    const loginBody = JSON.parse(loginOk.body) as { userId: string; accessToken: string };
    expect(loginBody.userId).toBe(userId);
  });

  it('disable: wrong code rejected; correct code clears mfaEnabled', async () => {
    if (!dbReachable) return;
    const { userId, accessToken } = await registerUser('disable');

    // Enroll.
    const setup = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/mfa/setup',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const { base32 } = JSON.parse(setup.body) as { base32: string };
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/mfa/verify',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { code: totp(base32) },
    });

    // Disable with a wrong code → 401 INVALID_MFA.
    const badDisable = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/mfa/disable',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { code: '000000' },
    });
    expect(badDisable.statusCode).toBe(401);
    expect(JSON.parse(badDisable.body).code).toBe('INVALID_MFA');
    const stillOn = await prisma.user.findUnique({ where: { id: userId } });
    expect(stillOn?.mfaEnabled).toBe(true);

    // Disable with a real code.
    const okDisable = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/mfa/disable',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { code: totp(base32) },
    });
    expect(okDisable.statusCode).toBe(204);
    const cleared = await prisma.user.findUnique({ where: { id: userId } });
    expect(cleared?.mfaEnabled).toBe(false);
    expect(cleared?.mfaSecret).toBeNull();
  });

  it('setup is rejected when MFA already enabled', async () => {
    if (!dbReachable) return;
    const { accessToken } = await registerUser('already-on');

    const setup1 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/mfa/setup',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const { base32 } = JSON.parse(setup1.body) as { base32: string };
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/mfa/verify',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { code: totp(base32) },
    });

    const setup2 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/mfa/setup',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(setup2.statusCode).toBe(409);
    expect(JSON.parse(setup2.body).code).toBe('MFA_ALREADY_ENABLED');
  });

  it('mfa endpoints require authentication (401 without bearer)', async () => {
    if (!dbReachable) return;
    const setup = await app.inject({ method: 'POST', url: '/api/v1/auth/mfa/setup' });
    expect(setup.statusCode).toBe(401);

    const verify = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/mfa/verify',
      payload: { code: '123456' },
    });
    expect(verify.statusCode).toBe(401);
  });
});
