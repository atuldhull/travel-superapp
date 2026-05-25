/**
 * Integration tests for the passwordless magic-link flow ([V.UX.2]).
 *
 * Covers:
 *   1. Request → 200 ok + email landed in stub mailer.
 *   2. Consume → 200 + access token + refresh cookie + working /auth/me.
 *   3. First-time consume creates a new password-less User; second
 *      consume of the same token → 401 MAGIC_LINK_INVALID (single-use).
 *   4. Existing user (registered with password) → magic-link sign-in
 *      issues a session for that same user (no duplicate row).
 *   5. Expired token → 401 MAGIC_LINK_INVALID (we DB-tweak expiresAt
 *      to simulate elapsed time).
 *   6. Wrong / malformed token → 401 / 400.
 *   7. Soft rate-limit: 6th request inside 15-min window is silently
 *      no-oped (200 ok, but no new email).
 *
 * Installed by prompt [V.UX.2].
 */
import { createHash } from 'node:crypto';
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';
import {
  clearStubMessages,
  getAllStubMessages,
  getLastStubMessage,
} from '../src/common/mailer/stub-mailer.adapter';
import { uniqueEmail } from './factories';

const TEST_PREFIX = 'magic-link-e2e';

describe('Magic-link sign-in (integration, requires Docker Postgres)', () => {
  let moduleRef: TestingModule;
  let app: NestFastifyApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.useGlobalFilters(new AllExceptionFilter(), new DomainExceptionFilter());
    app.setGlobalPrefix('api/v1', { exclude: ['health', 'health/(.*)'] });
    await app.register(fastifyCookie);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    prisma = moduleRef.get(PrismaService);
    await prisma.$queryRaw`SELECT 1`;
  });

  beforeEach(() => {
    clearStubMessages();
  });

  afterEach(async () => {
    // Clean tokens minted during the test, plus any test-prefixed users.
    await prisma.magicLinkToken.deleteMany({});
    await prisma.user.deleteMany({
      where: { displayName: { startsWith: TEST_PREFIX } },
    });
    // Also nuke the password-less Travelers created by first-time consume
    // (they're hard to identify by emailHash post-test). Filter by the
    // same email-suffix prefix we use for test addresses.
    await prisma.user.deleteMany({
      where: { displayName: 'Traveler' },
    });
  });

  afterAll(async () => {
    await app.close();
    await moduleRef.close();
  });

  // [K1] this file used to define a local `uniqueEmail(suffix)`
  // wrapper that prepended TEST_PREFIX. After the J1 codemod swept
  // the call sites, the local function shadowed the factory import +
  // recursed into itself (infinite loop). The imported uniqueEmail
  // from './factories' takes the same prefix-string and produces the
  // unique slug; we keep a thin wrapper so call sites stay readable.
  function uniqueEmailFor(suffix: string): string {
    return uniqueEmail(`${TEST_PREFIX}-${suffix}`);
  }

  /** Pull the magic-link token out of the most recent stubbed email. */
  function extractTokenFromLastMail(): string {
    const msg = getLastStubMessage();
    if (!msg) throw new Error('no stubbed mail');
    const match = msg.textBody.match(/\/auth\/magic-link\/([0-9a-f]{64})/);
    if (!match || !match[1]) throw new Error('token not found in mail body');
    return match[1];
  }

  it('request → 200 ok; one email queued in stub mailer', async () => {
    const email = uniqueEmailFor('request-200');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/magic-link/request',
      payload: { email },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ status: 'ok' });
    const mail = getLastStubMessage();
    expect(mail).not.toBeNull();
    expect(mail!.to).toBe(email);
    expect(mail!.textBody).toMatch(/\/auth\/magic-link\/[0-9a-f]{64}/);
  });

  it('happy path: request → consume → access token + refresh cookie + /auth/me works', async () => {
    const email = uniqueEmailFor('happy');
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/magic-link/request',
      payload: { email },
    });
    const token = extractTokenFromLastMail();

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/magic-link/consume',
      payload: { token },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { userId: string; accessToken: string; expiresAt: string };
    expect(body.userId).toMatch(/^[a-z0-9]{20,}$/);
    expect(body.accessToken).toMatch(/\./);
    const setCookies = res.headers['set-cookie'];
    const cookie = Array.isArray(setCookies)
      ? (setCookies.find((c) => c.startsWith('refresh_token=')) ?? '')
      : typeof setCookies === 'string' && setCookies.startsWith('refresh_token=')
        ? setCookies
        : '';
    expect(cookie).not.toBe('');

    const me = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: `Bearer ${body.accessToken}` },
    });
    expect(me.statusCode).toBe(200);
    expect(JSON.parse(me.body).sub).toBe(body.userId);
  });

  it('single-use: consuming the same token twice → second call 401 MAGIC_LINK_INVALID', async () => {
    const email = uniqueEmailFor('single-use');
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/magic-link/request',
      payload: { email },
    });
    const token = extractTokenFromLastMail();

    const first = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/magic-link/consume',
      payload: { token },
    });
    expect(first.statusCode).toBe(200);

    const second = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/magic-link/consume',
      payload: { token },
    });
    expect(second.statusCode).toBe(401);
    expect(JSON.parse(second.body).code).toBe('MAGIC_LINK_INVALID');
  });

  it('existing password-user signs in via magic link without duplicate row', async () => {
    // Register first via password.
    const email = uniqueEmailFor('existing-user');
    const reg = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email,
        password: 'correct-horse-battery-staple',
        displayName: `${TEST_PREFIX}-existing`,
      },
    });
    expect(reg.statusCode).toBe(201);
    const passwordUserId = JSON.parse(reg.body).userId as string;

    // Now magic-link the same email.
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/magic-link/request',
      payload: { email },
    });
    const token = extractTokenFromLastMail();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/magic-link/consume',
      payload: { token },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).userId).toBe(passwordUserId);
  });

  it('expired token → 401 MAGIC_LINK_INVALID', async () => {
    const email = uniqueEmailFor('expired');
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/magic-link/request',
      payload: { email },
    });
    const token = extractTokenFromLastMail();

    // Backdate expiresAt so the next consume sees expiration.
    const pepper = process.env.EMAIL_PEPPER!;
    const tokenHash = createHash('sha256').update(`${pepper}${token}`).digest('hex');
    await prisma.magicLinkToken.update({
      where: { tokenHash },
      data: { expiresAt: new Date(Date.now() - 60 * 1000) },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/magic-link/consume',
      payload: { token },
    });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).code).toBe('MAGIC_LINK_INVALID');
  });

  it('wrong token → 401 MAGIC_LINK_INVALID; malformed token → 422 VALIDATION_FAILED', async () => {
    const wrong = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/magic-link/consume',
      payload: { token: 'a'.repeat(64) },
    });
    expect(wrong.statusCode).toBe(401);
    expect(JSON.parse(wrong.body).code).toBe('MAGIC_LINK_INVALID');

    // Zod validation errors surface via the project's ValidationError →
    // 422 VALIDATION_FAILED (not the generic 400). Same shape every
    // other body-validated route returns.
    const malformed = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/magic-link/consume',
      payload: { token: 'not-hex' },
    });
    expect(malformed.statusCode).toBe(422);
    expect(JSON.parse(malformed.body).code).toBe('VALIDATION_FAILED');
  });

  it('soft rate-limit: 6th request in 15-min window is silently no-oped', async () => {
    const email = uniqueEmailFor('rate-limit');
    for (let i = 0; i < 5; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/magic-link/request',
        payload: { email },
      });
      expect(res.statusCode).toBe(200);
    }
    expect(getAllStubMessages().length).toBe(5);

    const sixth = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/magic-link/request',
      payload: { email },
    });
    expect(sixth.statusCode).toBe(200);
    // No new email should have been queued.
    expect(getAllStubMessages().length).toBe(5);
  });
});
