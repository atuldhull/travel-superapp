/**
 * V.UX.33 — integration tests for the account-reactivation flow.
 *
 *   1. Login with valid credentials AFTER soft-delete (within 7d) →
 *      401 ACCOUNT_DELETION_PENDING + reactivationToken in context.
 *   2. POST /account/reactivate with the token → 200 + restoreUser
 *      flips deletedAt back to null. Subsequent /login succeeds.
 *   3. Re-clicking the reactivation link → 404 ACCOUNT_NOT_RECOVERABLE
 *      (idempotent: account is already active).
 *   4. After 7d simulated (backdating User.deletedAt + then purger
 *      sweep would happen — we just simulate "row is gone" via hard
 *      delete) → /login returns INVALID_CREDENTIALS.
 *   5. DELETE /account fires the deletion-pending email with the
 *      reactivate URL.
 *   6. Tampered token → 401 REACTIVATION_INVALID.
 *
 * Installed by prompt [V.UX.33].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';
import { clearStubMessages, getAllStubMessages } from '../src/common/mailer/stub-mailer.adapter';

const TEST_PREFIX = 'reactivation-e2e';

interface RegisterRes {
  userId: string;
  accessToken: string;
}

function readReactivationTokenFromMail(email: string): string {
  const sent = getAllStubMessages();
  for (let i = sent.length - 1; i >= 0; i--) {
    const m = sent[i];
    if (!m) continue;
    if (m.to !== email) continue;
    const match = m.textBody.match(/account\/reactivate\?token=([^\s]+)/);
    if (match && match[1]) return decodeURIComponent(match[1]);
  }
  throw new Error(`No deletion-pending email found for ${email}`);
}

describe('V.UX.33 reactivation flow (integration, requires Docker Postgres)', () => {
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
      // eslint-disable-next-line no-console
      console.warn(
        `reactivation: DB not reachable (${err instanceof Error ? err.message : String(err)}). Skipping.`,
      );
      dbReachable = false;
    }
  });

  beforeEach(() => {
    clearStubMessages();
  });

  afterEach(async () => {
    if (!dbReachable) return;
    await prisma.user.deleteMany({ where: { displayName: { startsWith: TEST_PREFIX } } });
  });

  afterAll(async () => {
    if (dbReachable) await app.close();
    await moduleRef.close();
  });

  async function registerUser(suffix: string): Promise<{ userId: string; email: string }> {
    const email = `${TEST_PREFIX}-${suffix}-${Date.now()}@example.com`;
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email,
        password: 'correct-horse-battery-staple',
        displayName: `${TEST_PREFIX}-${suffix}`,
      },
    });
    expect(res.statusCode).toBe(201);
    return { userId: (JSON.parse(res.body) as RegisterRes).userId, email };
  }

  async function softDelete(email: string, password: string) {
    // Need an authed bearer to call DELETE /account. /login first.
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password },
    });
    expect(login.statusCode).toBe(200);
    const token = (JSON.parse(login.body) as { accessToken: string }).accessToken;
    const del = await app.inject({
      method: 'DELETE',
      url: '/api/v1/account',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(del.statusCode).toBe(204);
  }

  it('Login on soft-deleted account → 401 ACCOUNT_DELETION_PENDING + token in context', async () => {
    if (!dbReachable) return;
    const { email } = await registerUser('pending');
    await softDelete(email, 'correct-horse-battery-staple');

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password: 'correct-horse-battery-staple' },
    });
    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body) as {
      code: string;
      context: { reactivationToken?: string; retentionExpiresAt?: string };
    };
    expect(body.code).toBe('ACCOUNT_DELETION_PENDING');
    expect(typeof body.context.reactivationToken).toBe('string');
    expect(body.context.reactivationToken!.length).toBeGreaterThan(20);
    expect(typeof body.context.retentionExpiresAt).toBe('string');
  });

  it('Reactivate restores account; subsequent login succeeds', async () => {
    if (!dbReachable) return;
    const { email } = await registerUser('restore');
    await softDelete(email, 'correct-horse-battery-staple');
    const tokenFromEmail = readReactivationTokenFromMail(email);

    const reactivate = await app.inject({
      method: 'POST',
      url: '/api/v1/account/reactivate',
      payload: { token: tokenFromEmail },
    });
    expect(reactivate.statusCode).toBe(200);

    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password: 'correct-horse-battery-staple' },
    });
    expect(login.statusCode).toBe(200);
  });

  it('Re-clicking reactivation link → 404 ACCOUNT_NOT_RECOVERABLE', async () => {
    if (!dbReachable) return;
    const { email } = await registerUser('replay');
    await softDelete(email, 'correct-horse-battery-staple');
    const tokenFromEmail = readReactivationTokenFromMail(email);
    const first = await app.inject({
      method: 'POST',
      url: '/api/v1/account/reactivate',
      payload: { token: tokenFromEmail },
    });
    expect(first.statusCode).toBe(200);
    const second = await app.inject({
      method: 'POST',
      url: '/api/v1/account/reactivate',
      payload: { token: tokenFromEmail },
    });
    expect(second.statusCode).toBe(404);
    expect(JSON.parse(second.body).code).toBe('ACCOUNT_NOT_RECOVERABLE');
  });

  it('Tampered token → 401 REACTIVATION_INVALID', async () => {
    if (!dbReachable) return;
    const { email } = await registerUser('tamper');
    await softDelete(email, 'correct-horse-battery-staple');
    const valid = readReactivationTokenFromMail(email);
    // Flip one character in the middle.
    const tampered = valid.slice(0, 30) + (valid[30] === 'A' ? 'B' : 'A') + valid.slice(31);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/account/reactivate',
      payload: { token: tampered },
    });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).code).toBe('REACTIVATION_INVALID');
  });

  it('Past 7-day window → /login returns INVALID_CREDENTIALS', async () => {
    if (!dbReachable) return;
    const { userId, email } = await registerUser('window-past');
    await softDelete(email, 'correct-horse-battery-staple');
    // Backdate deletedAt past the 7-day cutoff.
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    await prisma.user.update({ where: { id: userId }, data: { deletedAt: eightDaysAgo } });

    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password: 'correct-horse-battery-staple' },
    });
    expect(login.statusCode).toBe(401);
    expect(JSON.parse(login.body).code).toBe('INVALID_CREDENTIALS');
  });

  it('DELETE /account sends deletion-pending email with reactivate URL', async () => {
    if (!dbReachable) return;
    const { email } = await registerUser('email');
    await softDelete(email, 'correct-horse-battery-staple');
    const sent = getAllStubMessages();
    const m = sent.find((x) => x.to === email);
    expect(m).toBeDefined();
    expect(m!.subject.toLowerCase()).toContain('deletion');
    expect(m!.textBody).toMatch(/account\/reactivate\?token=/);
  });
});
