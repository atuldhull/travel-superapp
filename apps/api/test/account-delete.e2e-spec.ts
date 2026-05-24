/**
 * Integration tests for `DELETE /account` ([IV.18.16.2]).
 *
 * Right-to-erasure (GDPR Art. 17 / DPDP §12 / COPPA parental
 * delete). Verifies:
 *
 *   1. Unauthenticated → 401.
 *   2. Happy path → 204; User.deletedAt set; all live sessions
 *      revoked.
 *   3. Subsequent login with the same credentials → 401
 *      INVALID_CREDENTIALS (the user repo treats soft-deleted
 *      rows as absent — same path as a wrong email).
 *   4. Subsequent /refresh with the cookie → 401 (session was
 *      revoked at delete time).
 *   5. Second DELETE on an already-deleted account → 401 (the
 *      JwtAuthGuard's underlying token verify still works for
 *      the access token's TTL, BUT the use-case sees
 *      `count === 0` since the row is already deletedAt-set →
 *      maps to 404 USER_NOT_FOUND). Actually we test the more
 *      realistic case: a user can't even hit the route a second
 *      time with a fresh login because login is dead.
 *   6. Cross-user isolation: Bob's delete only affects Bob.
 *
 * Installed by prompt [IV.18.16.2].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';
import { registerUser as registerViaFactory, TEST_PASSWORD } from './factories';

const TEST_PREFIX = 'account-delete-e2e';

describe('DELETE /account (integration, requires Docker Postgres)', () => {
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
      console.warn(`account-delete test: DB not reachable (${message}). Skipping.`);
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
    if (dbReachable) await app.close();
    await moduleRef.close();
  });

  // [I1] thin wrapper — delegates to the factory + adds the per-
  // suite prefix so cleanup `where: startsWith(TEST_PREFIX)` still
  // hits this suite's rows. The factory handles the Date.now()-free
  // unique email + refresh cookie extraction once for every test.
  async function registerUser(suffix: string): Promise<{
    userId: string;
    accessToken: string;
    email: string;
    password: string;
    refreshCookie: string;
  }> {
    const u = await registerViaFactory(app, { prefix: TEST_PREFIX, hint: suffix });
    return {
      userId: u.userId,
      accessToken: u.accessToken,
      email: u.email,
      password: u.password,
      refreshCookie: u.refreshCookie,
    };
  }

  // Silences the unused-import warning until the test wants to
  // assert the password directly.
  void TEST_PASSWORD;

  it('DELETE /account without bearer → 401', async () => {
    if (!dbReachable) return;
    const res = await app.inject({ method: 'DELETE', url: '/api/v1/account' });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).code).toBe('UNAUTHENTICATED');
  });

  it('happy path → 204; User.deletedAt set; live sessions revoked', async () => {
    if (!dbReachable) return;
    const { userId, accessToken } = await registerUser('happy');

    // Sanity — user exists and has at least one live session.
    const beforeUser = await prisma.user.findUnique({ where: { id: userId } });
    expect(beforeUser!.deletedAt).toBeNull();
    const beforeSessions = await prisma.session.count({
      where: { userId, revokedAt: null },
    });
    expect(beforeSessions).toBeGreaterThanOrEqual(1);

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/v1/account',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(204);
    expect(res.body).toBe('');

    const afterUser = await prisma.user.findUnique({ where: { id: userId } });
    expect(afterUser!.deletedAt).not.toBeNull();
    const liveSessions = await prisma.session.count({
      where: { userId, revokedAt: null },
    });
    expect(liveSessions).toBe(0);
  });

  it('after delete → login with same credentials → 401 ACCOUNT_DELETION_PENDING (V.UX.33)', async () => {
    if (!dbReachable) return;
    const { accessToken, email, password } = await registerUser('login-after');

    await app.inject({
      method: 'DELETE',
      url: '/api/v1/account',
      headers: { authorization: `Bearer ${accessToken}` },
    });

    // V.UX.33 — within the 7-day retention window, login surfaces the
    // reactivation challenge instead of a generic INVALID_CREDENTIALS.
    // Past 7 days the row is purged + login degrades back to
    // INVALID_CREDENTIALS; covered in reactivation.e2e-spec.
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password },
    });
    expect(login.statusCode).toBe(401);
    const body = JSON.parse(login.body) as {
      code: string;
      context: { reactivationToken?: string };
    };
    expect(body.code).toBe('ACCOUNT_DELETION_PENDING');
    expect(typeof body.context.reactivationToken).toBe('string');
  });

  it('after delete → /refresh fails (session revoked)', async () => {
    if (!dbReachable) return;
    const { accessToken, refreshCookie } = await registerUser('refresh-after');

    await app.inject({
      method: 'DELETE',
      url: '/api/v1/account',
      headers: { authorization: `Bearer ${accessToken}` },
    });

    const refresh = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      headers: { cookie: refreshCookie },
    });
    expect(refresh.statusCode).toBe(401);
    // Could be REFRESH_REUSE_DETECTED (revoked-row replay cascade) or
    // REFRESH_USER_MISSING — both are correct security signals after
    // a delete. Just assert it's a 401 with one of those codes.
    const code = JSON.parse(refresh.body).code as string;
    expect(['REFRESH_REUSE_DETECTED', 'REFRESH_USER_MISSING', 'REFRESH_EXPIRED']).toContain(code);
  });

  it('cross-user isolation: Alice’s delete leaves Bob untouched', async () => {
    if (!dbReachable) return;
    const alice = await registerUser('alice');
    const bob = await registerUser('bob');

    await app.inject({
      method: 'DELETE',
      url: '/api/v1/account',
      headers: { authorization: `Bearer ${alice.accessToken}` },
    });

    // Alice gone; Bob still healthy.
    const aliceRow = await prisma.user.findUnique({ where: { id: alice.userId } });
    expect(aliceRow!.deletedAt).not.toBeNull();
    const bobRow = await prisma.user.findUnique({ where: { id: bob.userId } });
    expect(bobRow!.deletedAt).toBeNull();
    const bobSessions = await prisma.session.count({
      where: { userId: bob.userId, revokedAt: null },
    });
    expect(bobSessions).toBeGreaterThanOrEqual(1);

    // Bob can still hit authed routes.
    const bobExport = await app.inject({
      method: 'GET',
      url: '/api/v1/account/export',
      headers: { authorization: `Bearer ${bob.accessToken}` },
    });
    expect(bobExport.statusCode).toBe(200);
  });

  it('idempotent guard: a second delete with the same (still-valid) access token → 404', async () => {
    if (!dbReachable) return;
    const { accessToken } = await registerUser('idem');

    const first = await app.inject({
      method: 'DELETE',
      url: '/api/v1/account',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(first.statusCode).toBe(204);

    // Access token is stateless — it still verifies until TTL expiry
    // (15 min). The use-case sees `count === 0` (already-deleted row
    // is excluded by the `deletedAt: null` clause) and 404s. This
    // is the documented v1 trade-off — no per-request DB lookup in
    // the JwtAuthGuard, capped worst-case window at the access-token
    // TTL.
    const second = await app.inject({
      method: 'DELETE',
      url: '/api/v1/account',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(second.statusCode).toBe(404);
    expect(JSON.parse(second.body).code).toBe('USER_NOT_FOUND');
  });
});
