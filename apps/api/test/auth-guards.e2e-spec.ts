/**
 * Integration tests for the global guard chain ([III.11.3]):
 *   - `JwtAuthGuard` — protects every route unless `@Public()`.
 *   - `RolesGuard` — enforces `@Roles(...)` metadata.
 *   - `@CurrentUser()` — hydrates the handler param from `req.user`.
 *
 * Shape of the test:
 *   1. Prove `/health/live` + `/api/v1/auth/register` stay reachable
 *      without a token (`@Public()` survives the global guard).
 *   2. Register a user, grab the access token, hit the only protected
 *      route we have so far (`GET /api/v1/auth/me`):
 *        - missing header          → 401 `UNAUTHENTICATED`
 *        - bogus bearer            → 401 `UNAUTHENTICATED` (reason=INVALID)
 *        - malformed Authorization → 401 `UNAUTHENTICATED`
 *        - valid token             → 200 { sub, sid, role }
 *   3. A synthetic admin-only route (declared in a tiny
 *      `GuardTestModule`) proves `@Roles('admin')` rejects a plain
 *      user with 403 `ROLE_FORBIDDEN` and accepts an admin (by
 *      directly minting an admin token via `TokenService`).
 *
 * Installed by prompt [III.11.3].
 */
import fastifyCookie from '@fastify/cookie';
import { Controller, Get, Module, type INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { type AuthenticatedUser, CurrentUser, Roles } from '../src/common/auth';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';
import {
  TOKEN_SERVICE,
  type TokenService,
} from '../src/modules/identity/application/ports/token.service';

// Synthetic test-only admin surface. Lives here (not in src/) so the
// production build never ships an unauthenticated admin probe.
@Controller('guard-test')
class GuardTestController {
  @Get('admin-only')
  @Roles('admin')
  adminOnly(@CurrentUser() user: AuthenticatedUser): { ok: true; sub: string } {
    return { ok: true, sub: user.sub };
  }

  @Get('any-authenticated')
  anyAuth(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }
}

@Module({ controllers: [GuardTestController] })
class GuardTestModule {}

const TEST_PREFIX = 'guard-e2e';

describe('Auth guards (integration, requires Docker Postgres)', () => {
  let moduleRef: TestingModule;
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let tokens: TokenService;
  let dbReachable = true;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule, GuardTestModule],
    }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.useGlobalFilters(new AllExceptionFilter(), new DomainExceptionFilter());
    app.setGlobalPrefix('api/v1', { exclude: ['health', 'health/(.*)'] });
    await app.register(fastifyCookie);
    try {
      await (app as INestApplication).init();
      await app.getHttpAdapter().getInstance().ready();
      prisma = moduleRef.get(PrismaService);
      tokens = moduleRef.get<TokenService>(TOKEN_SERVICE);
      await prisma.$queryRaw`SELECT 1`;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // eslint-disable-next-line no-console
      console.warn(`auth-guards integration test: DB not reachable (${message}). Skipping.`);
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
    if (dbReachable) {
      await app.close();
    }
    await moduleRef.close();
  });

  async function registerAndGetToken(
    suffix: string,
  ): Promise<{ userId: string; accessToken: string }> {
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
    const body = JSON.parse(res.body) as { userId: string; accessToken: string };
    return body;
  }

  it('public routes — /health/live + /auth/register — are reachable without a token', async () => {
    if (!dbReachable) return;
    const live = await app.inject({ method: 'GET', url: '/health/live' });
    expect(live.statusCode).toBe(200);

    const register = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: `${TEST_PREFIX}-public-${Date.now()}@example.com`,
        password: 'correct-horse-battery-staple',
        displayName: `${TEST_PREFIX}-public`,
      },
    });
    expect(register.statusCode).toBe(201);
  });

  it('protected /auth/me — missing bearer → 401 UNAUTHENTICATED', async () => {
    if (!dbReachable) return;
    const res = await app.inject({ method: 'GET', url: '/api/v1/auth/me' });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).code).toBe('UNAUTHENTICATED');
  });

  it('protected /auth/me — malformed Authorization → 401 UNAUTHENTICATED', async () => {
    if (!dbReachable) return;
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: 'Basic abc123' },
    });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).code).toBe('UNAUTHENTICATED');
  });

  it('protected /auth/me — bogus bearer token → 401 UNAUTHENTICATED', async () => {
    if (!dbReachable) return;
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: 'Bearer not.a.jwt' },
    });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).code).toBe('UNAUTHENTICATED');
  });

  it('protected /auth/me — valid access token → 200 with {sub, sid, role}', async () => {
    if (!dbReachable) return;
    const { userId, accessToken } = await registerAndGetToken('me-ok');
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as AuthenticatedUser;
    expect(body.sub).toBe(userId);
    expect(body.role).toBe('user');
    expect(body.sid).toMatch(/[0-9a-f-]{36}/i); // uuid
  });

  it('RolesGuard — @Roles("admin") on a `user` token → 403 ROLE_FORBIDDEN', async () => {
    if (!dbReachable) return;
    const { accessToken } = await registerAndGetToken('role-user');
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/guard-test/admin-only',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body) as { code: string; context?: { actual: string } };
    expect(body.code).toBe('ROLE_FORBIDDEN');
    expect(body.context?.actual).toBe('user');
  });

  it('RolesGuard — @Roles("admin") on an admin-minted token → 200', async () => {
    if (!dbReachable) return;
    // Mint a synthetic admin token directly through the TokenService
    // port — we don't expose an admin-create endpoint yet, so this is
    // the appropriate seam for exercising the role path.
    const issued = await tokens.issueAccessToken({
      userId: 'admin-synthetic',
      sessionId: '11111111-1111-4111-8111-111111111111',
      role: 'admin',
    });
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/guard-test/admin-only',
      headers: { authorization: `Bearer ${issued.token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { ok: true; sub: string };
    expect(body.sub).toBe('admin-synthetic');
  });

  it('@CurrentUser() — protected route without @Roles still reads req.user', async () => {
    if (!dbReachable) return;
    const { userId, accessToken } = await registerAndGetToken('current-user');
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/guard-test/any-authenticated',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as AuthenticatedUser;
    expect(body.sub).toBe(userId);
  });
});
