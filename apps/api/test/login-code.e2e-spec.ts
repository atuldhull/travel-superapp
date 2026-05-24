/**
 * Integration tests for passwordless OTP sign-in (Phase 1 — B1/B2).
 *
 * Covers:
 *   1. Email request → 200 ok + 6-digit code in the stub mailer.
 *   2. Email verify → 200 + access token + refresh cookie + /auth/me.
 *   3. Phone request → code in the stub SMS sender; verify → 200,
 *      creates a phone-only user.
 *   4. Single-use: re-verifying a consumed code → 401 LOGIN_CODE_INVALID.
 *   5. Wrong code → 401 LOGIN_CODE_INVALID.
 *   6. Soft rate-limit: 6th request in the window is silently no-oped.
 *
 * Mirrors the magic-link e2e harness.
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';
import { clearStubMessages, getLastStubMessage } from '../src/common/mailer/stub-mailer.adapter';
import {
  clearStubSms,
  getLastStubSms,
} from '../src/modules/identity/infrastructure/stub-sms-sender.adapter';
import { uniqueEmail } from './factories';

describe('Passwordless OTP sign-in (integration, requires Docker Postgres)', () => {
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
      console.warn(`login-code test: DB not reachable (${message}). Skipping.`);
      dbReachable = false;
    }
  });

  beforeEach(() => {
    clearStubMessages();
    clearStubSms();
  });

  afterEach(async () => {
    await prisma.loginCode.deleteMany({});
    await prisma.user.deleteMany({ where: { displayName: 'Traveler' } });
  });

  afterAll(async () => {
    if (dbReachable) await app.close();
    await moduleRef.close();
  });

  const code6 = (text: string): string => {
    const m = text.match(/\b(\d{6})\b/);
    if (!m || !m[1]) throw new Error(`no 6-digit code in: ${text}`);
    return m[1];
  };

  it('email: request → 200 + code mailed; verify → token + refresh cookie + /auth/me', async () => {
    const destination = uniqueEmail('otp-e2e');

    const reqRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/otp/request',
      payload: { channel: 'email', destination },
    });
    expect(reqRes.statusCode).toBe(200);
    expect(JSON.parse(reqRes.body)).toEqual({ status: 'ok' });
    const mail = getLastStubMessage();
    expect(mail).not.toBeNull();
    expect(mail!.to).toBe(destination);
    const code = code6(mail!.textBody);

    const verifyRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/otp/verify',
      payload: { channel: 'email', destination, code },
    });
    expect(verifyRes.statusCode).toBe(200);
    const body = JSON.parse(verifyRes.body) as { accessToken: string; userId: string };
    expect(body.accessToken).toBeTruthy();
    expect(verifyRes.headers['set-cookie']).toBeDefined();

    const me = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: `Bearer ${body.accessToken}` },
    });
    expect(me.statusCode).toBe(200);

    // Single-use: same code again → 401.
    const reuse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/otp/verify',
      payload: { channel: 'email', destination, code },
    });
    expect(reuse.statusCode).toBe(401);
    expect(JSON.parse(reuse.body).code).toBe('LOGIN_CODE_INVALID');
  });

  it('phone: request → code via SMS; verify → 200 creates a phone-only user', async () => {
    const destination = `+1999${String(Date.now()).slice(-7)}`;

    const reqRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/otp/request',
      payload: { channel: 'phone', destination },
    });
    expect(reqRes.statusCode).toBe(200);
    const sms = getLastStubSms();
    expect(sms).not.toBeNull();
    expect(sms!.to).toBe(destination);
    const code = code6(sms!.body);

    const verifyRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/otp/verify',
      payload: { channel: 'phone', destination, code },
    });
    expect(verifyRes.statusCode).toBe(200);
    expect(JSON.parse(verifyRes.body).accessToken).toBeTruthy();
  });

  it('wrong code → 401 LOGIN_CODE_INVALID', async () => {
    const destination = uniqueEmail('otp-wrong');
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/otp/request',
      payload: { channel: 'email', destination },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/otp/verify',
      payload: { channel: 'email', destination, code: '000000' },
    });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).code).toBe('LOGIN_CODE_INVALID');
  });

  it('soft rate-limit: 6th request in the window mints no new code', async () => {
    const destination = uniqueEmail('otp-rl');
    for (let i = 0; i < 5; i += 1) {
      await app.inject({
        method: 'POST',
        url: '/api/v1/auth/otp/request',
        payload: { channel: 'email', destination },
      });
    }
    clearStubMessages();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/otp/request',
      payload: { channel: 'email', destination },
    });
    expect(res.statusCode).toBe(200);
    expect(getLastStubMessage()).toBeNull();
  });
});
