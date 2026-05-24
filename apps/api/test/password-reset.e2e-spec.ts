/**
 * V.UX.31 — integration tests for the password-reset flow.
 *
 *   1. POST /auth/password-reset/request → 200 ok regardless of
 *      whether the email exists.
 *   2. Successful request enqueues an email containing a 64-hex token.
 *   3. POST /auth/password-reset/consume with valid token + new
 *      password → 200; the new password works for /login.
 *   4. Re-consuming the same token → 401 RESET_TOKEN_INVALID
 *      (single-use).
 *   5. Weak password → 422 WEAK_PASSWORD.
 *   6. Soft rate-limit: > 5 requests for the same email within 15 min
 *      stops minting new tokens (still returns ok).
 *
 * Installed by prompt [V.UX.31].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';
import { clearStubMessages, getAllStubMessages } from '../src/common/mailer/stub-mailer.adapter';
import { uniqueEmail, uniqueSuffix } from './factories';

const TEST_PREFIX = 'password-reset-e2e';

function readResetTokenFromMail(email: string): string {
  const sent = getAllStubMessages();
  for (let i = sent.length - 1; i >= 0; i--) {
    const m = sent[i];
    if (!m) continue;
    if (m.to !== email) continue;
    const match = m.textBody.match(/login\/reset\/([0-9a-f]{64})/);
    if (match && match[1]) return match[1];
  }
  throw new Error(`No reset email found for ${email}`);
}

describe('V.UX.31 password-reset flow (integration, requires Docker Postgres)', () => {
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
      console.warn(`password-reset test: DB not reachable (${message}). Skipping.`);
      dbReachable = false;
    }
  });

  beforeEach(() => {
    clearStubMessages();
  });

  afterEach(async () => {
    await prisma.passwordResetToken.deleteMany({});
    await prisma.user.deleteMany({ where: { displayName: { startsWith: TEST_PREFIX } } });
  });

  afterAll(async () => {
    if (dbReachable) await app.close();
    await moduleRef.close();
  });

  async function registerUser(suffix: string): Promise<{ email: string }> {
    const email = uniqueEmail(`${TEST_PREFIX}-${suffix}`);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email, password: 'old-password-123!', displayName: `${TEST_PREFIX}-${suffix}` },
    });
    expect(res.statusCode).toBe(201);
    return { email };
  }

  it('Request returns ok even for unknown emails (enumeration-safe)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/password-reset/request',
      payload: { email: `${TEST_PREFIX}-nobody-${uniqueSuffix()}@example.com` },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).status).toBe('ok');
  });

  it('Happy path: request → consume → login with new password', async () => {
    const { email } = await registerUser('happy');
    const req = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/password-reset/request',
      payload: { email },
    });
    expect(req.statusCode).toBe(200);

    const token = readResetTokenFromMail(email);
    const newPassword = 'brand-new-secure-password-2026!';
    const consume = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/password-reset/consume',
      payload: { token, newPassword },
    });
    expect(consume.statusCode).toBe(200);

    // Old password no longer works.
    const oldLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password: 'old-password-123!' },
    });
    expect(oldLogin.statusCode).toBe(401);

    // New password does.
    const newLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password: newPassword },
    });
    expect(newLogin.statusCode).toBe(200);
  });

  it('Re-consuming the same token → 401 RESET_TOKEN_INVALID', async () => {
    const { email } = await registerUser('replay');
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/password-reset/request',
      payload: { email },
    });
    const token = readResetTokenFromMail(email);
    const ok = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/password-reset/consume',
      payload: { token, newPassword: 'first-replacement-pwd' },
    });
    expect(ok.statusCode).toBe(200);
    const replay = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/password-reset/consume',
      payload: { token, newPassword: 'second-replacement-pwd' },
    });
    expect(replay.statusCode).toBe(401);
    expect(JSON.parse(replay.body).code).toBe('RESET_TOKEN_INVALID');
  });

  it('Weak password → 422 (Zod min-length rejection)', async () => {
    const { email } = await registerUser('weak');
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/password-reset/request',
      payload: { email },
    });
    const token = readResetTokenFromMail(email);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/password-reset/consume',
      payload: { token, newPassword: 'short' },
    });
    expect(res.statusCode).toBe(422);
  });

  it('Soft rate-limit: 6th request in 15 min mints no new token', async () => {
    const { email } = await registerUser('limit');
    for (let i = 0; i < 5; i++) {
      const r = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/password-reset/request',
        payload: { email },
      });
      expect(r.statusCode).toBe(200);
    }
    const beforeCount = await prisma.passwordResetToken.count();
    const sixth = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/password-reset/request',
      payload: { email },
    });
    expect(sixth.statusCode).toBe(200);
    const afterCount = await prisma.passwordResetToken.count();
    expect(afterCount).toBe(beforeCount); // no new row
  });
});
