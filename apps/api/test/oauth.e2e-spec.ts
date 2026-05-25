/**
 * Integration tests for OAuth sign-in ([III.13.2.6]).
 *
 * Strategy: exercise the real `MockOAuthProvider` (registered
 * outside NODE_ENV=production) which accepts a JSON-encoded profile
 * as the "id token." Flexible enough to drive all three resolution
 * paths (existing link → email match → new user).
 *
 * NOTE on provider name on the link row. The mock adapter returns
 * `profile.provider = 'mock'`, so the DB row gets provider='mock'
 * even though the route was `POST /oauth/mock`. The path param is
 * the routing key (which adapter to pick) — the adapter's own
 * returned profile is what lands in the link table. Same pattern
 * Google adapter will follow (returns `'google'`).
 *
 * Installed by prompt [III.13.2.6].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';
import { uniqueSuffix } from './factories';

const TEST_PREFIX = 'oauth-e2e';

function mockToken(opts: {
  providerUserId: string;
  email: string;
  emailVerified?: boolean;
  displayName?: string;
}): string {
  return JSON.stringify({
    providerUserId: opts.providerUserId,
    email: opts.email,
    emailVerified: opts.emailVerified ?? true,
    displayName: opts.displayName,
  });
}

describe('OAuth sign-in (integration, requires Docker Postgres)', () => {
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

  afterEach(async () => {
    await prisma.user.deleteMany({
      where: { displayName: { startsWith: TEST_PREFIX } },
    });
  });

  afterAll(async () => {
    await app.close();
    await moduleRef.close();
  });

  it('unknown provider → 401 OAUTH_PROVIDER_UNKNOWN', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/oauth/does-not-exist',
      payload: {
        idToken: mockToken({
          providerUserId: 'x',
          email: `${TEST_PREFIX}-unk@example.com`,
        }),
      },
    });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).code).toBe('OAUTH_PROVIDER_UNKNOWN');
  });

  it('apple provider gated on env — unregistered in test (no APPLE_CLIENT_ID) → 401 OAUTH_PROVIDER_UNKNOWN', async () => {
    // Sanity: APPLE_CLIENT_ID isn't set in test/setup.ts, so the
    // factory registry never registers the Apple adapter. The route
    // still exists (path param routing), but the registry lookup
    // misses → OAUTH_PROVIDER_UNKNOWN. Proves the env-gated
    // registration pattern without needing to hit Apple's JWKS.
    expect(process.env['APPLE_CLIENT_ID']).toBeUndefined();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/oauth/apple',
      payload: {
        idToken: mockToken({
          providerUserId: 'apple-sub',
          email: `${TEST_PREFIX}-apple@example.com`,
        }),
      },
    });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).code).toBe('OAUTH_PROVIDER_UNKNOWN');
  });

  it('first sign-in creates a new user + issues a session (returns access token + cookie)', async () => {
    const email = `${TEST_PREFIX}-new-${uniqueSuffix()}@example.com`;
    const providerUserId = `pu-${uniqueSuffix()}`;
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/oauth/mock',
      payload: {
        idToken: mockToken({
          providerUserId,
          email,
          displayName: `${TEST_PREFIX}-new`,
        }),
      },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      userId: string;
      accessToken: string;
      expiresAt: string;
    };
    expect(body.userId).toMatch(/^c[a-z0-9]+/); // cuid
    expect(body.accessToken).toMatch(/^ey/);

    // Refresh cookie set.
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    const cookieStr = Array.isArray(cookies) ? cookies.join(';') : String(cookies);
    expect(cookieStr).toContain('refresh_token=');

    // DB: user exists + link row exists.
    const user = await prisma.user.findUnique({ where: { id: body.userId } });
    expect(user).not.toBeNull();
    expect(user!.passwordHash).toBeNull(); // OAuth-only account
    expect(user!.displayName).toBe(`${TEST_PREFIX}-new`);
    const link = await prisma.userOAuthIdentity.findUnique({
      where: { provider_providerUserId: { provider: 'mock', providerUserId } },
    });
    expect(link).not.toBeNull();
    expect(link!.userId).toBe(body.userId);
    expect(link!.providerEmail).toBe(email.toLowerCase());
  });

  it('second sign-in with same (provider, providerUserId) → same userId (existing-link path)', async () => {
    const email = `${TEST_PREFIX}-repeat-${uniqueSuffix()}@example.com`;
    const providerUserId = `pu-repeat-${uniqueSuffix()}`;
    const token = mockToken({
      providerUserId,
      email,
      displayName: `${TEST_PREFIX}-repeat`,
    });

    const first = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/oauth/mock',
      payload: { idToken: token },
    });
    const firstUserId = (JSON.parse(first.body) as { userId: string }).userId;

    const second = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/oauth/mock',
      payload: { idToken: token },
    });
    expect(second.statusCode).toBe(200);
    const secondUserId = (JSON.parse(second.body) as { userId: string }).userId;
    expect(secondUserId).toBe(firstUserId);

    // Only ONE link row across both sign-ins.
    const links = await prisma.userOAuthIdentity.findMany({
      where: { provider: 'mock', providerUserId },
    });
    expect(links).toHaveLength(1);
  });

  it('OAuth sign-in for a user who registered by email/password → auto-links by email', async () => {
    const email = `${TEST_PREFIX}-link-${uniqueSuffix()}@example.com`;

    // Register via password flow first.
    const reg = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email,
        password: 'correct-horse-battery-staple',
        displayName: `${TEST_PREFIX}-link`,
      },
    });
    expect(reg.statusCode).toBe(201);
    const passwordUserId = (JSON.parse(reg.body) as { userId: string }).userId;

    // Now sign in via OAuth with the SAME email.
    const providerUserId = `pu-link-${uniqueSuffix()}`;
    const oauth = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/oauth/mock',
      payload: {
        idToken: mockToken({ providerUserId, email }),
      },
    });
    expect(oauth.statusCode).toBe(200);
    const oauthUserId = (JSON.parse(oauth.body) as { userId: string }).userId;
    // Same user — we didn't fork the account.
    expect(oauthUserId).toBe(passwordUserId);

    // Link row exists for this user.
    const link = await prisma.userOAuthIdentity.findUnique({
      where: { provider_providerUserId: { provider: 'mock', providerUserId } },
    });
    expect(link).not.toBeNull();
    expect(link!.userId).toBe(passwordUserId);
  });

  it('malformed idToken JSON → 401 OAUTH_INVALID_TOKEN', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/oauth/mock',
      payload: { idToken: 'not-json{{{' },
    });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).code).toBe('OAUTH_INVALID_TOKEN');
  });

  it('token with emailVerified=false → 401 OAUTH_EMAIL_UNVERIFIED', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/oauth/mock',
      payload: {
        idToken: mockToken({
          providerUserId: `pu-unv-${uniqueSuffix()}`,
          email: `${TEST_PREFIX}-unv-${uniqueSuffix()}@example.com`,
          emailVerified: false,
        }),
      },
    });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).code).toBe('OAUTH_EMAIL_UNVERIFIED');
  });

  it('missing idToken → 422 VALIDATION_FAILED', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/oauth/mock',
      payload: {},
    });
    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body).code).toBe('VALIDATION_FAILED');
  });
});
