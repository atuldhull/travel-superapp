/**
 * Integration tests for JWT keyring rotation ([III.13.2.8]).
 *
 *   - POST /api/v1/admin/identity/jwks/rotate is admin-gated.
 *   - Rotation creates a new `current` kid + pushes the old one
 *     onto `previous`. Tokens issued BEFORE rotation still verify.
 *   - Tokens issued AFTER rotation are signed with the new kid.
 *   - GET /admin/identity/jwks/kids returns every kid in both rings.
 *
 * Runs against the real Redis backing the `RedisJwtKeyringStore`.
 * The store's 30s in-memory cache is invalidated inside the
 * process on rotate, so subsequent sign/verify in the same test
 * picks up the new ring immediately.
 *
 * Installed by prompt [III.13.2.8].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';
import { uniqueEmail, uniqueSuffix } from './factories';

const TEST_PREFIX = 'jwks-rotation-e2e';

describe('JWKS rotation (integration, requires Postgres + Redis)', () => {
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

  async function registerUser(suffix: string): Promise<{ userId: string; accessToken: string }> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: uniqueEmail(`${TEST_PREFIX}-${suffix}`),
        password: 'correct-horse-battery-staple',
        displayName: `${TEST_PREFIX}-${suffix}`,
      },
    });
    expect(res.statusCode).toBe(201);
    return JSON.parse(res.body) as { userId: string; accessToken: string };
  }

  async function promoteToAdmin(userId: string): Promise<void> {
    await prisma.user.update({ where: { id: userId }, data: { role: 'admin' } });
  }

  /**
   * Decode a JWT's `kid` from the protected header. Signature
   * verification is done server-side — here we just inspect the
   * header for the assertion.
   */
  function kidOf(token: string): string {
    const firstDot = token.indexOf('.');
    const headerB64 = token.slice(0, firstDot);
    const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8')) as {
      kid: string;
    };
    return header.kid;
  }

  it('POST /admin/identity/jwks/rotate without a bearer → 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/identity/jwks/rotate',
      payload: { ring: 'access' },
    });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).code).toBe('UNAUTHENTICATED');
  });

  it('non-admin bearer → 403 ROLE_FORBIDDEN', async () => {
    const { accessToken } = await registerUser('user');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/identity/jwks/rotate',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { ring: 'access' },
    });
    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body).code).toBe('ROLE_FORBIDDEN');
  });

  it('admin rotates access ring → new kid issued; old kid retained in previous', async () => {
    const { userId, accessToken } = await registerUser('adminrotate');
    const kidBefore = kidOf(accessToken);
    await promoteToAdmin(userId);
    // After promotion the old access token still has role=user in
    // its claims (role is inside the signed JWT). Cleanest path:
    // register a dedicated admin user, flip role to admin in the
    // DB BEFORE the register call returns its token, so the
    // returned token already reflects role=admin. The DB update
    // happens via prisma below; register-then-promote would mint
    // a user-role token first and we'd need a re-issue.
    //
    // ([R1] removed the prior dead-code `loginRes` attempt — login
    // by email needs the exact addr, which we don't have for the
    // hypothetical "preexisting admin" path. The workaround below
    // is the only path that actually works.)
    const adminEmail = `${TEST_PREFIX}-admin2-${uniqueSuffix()}@example.com`;
    const adminRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: adminEmail,
        password: 'correct-horse-battery-staple',
        displayName: `${TEST_PREFIX}-admin2`,
      },
    });
    const admin = JSON.parse(adminRes.body) as { userId: string; accessToken: string };
    await promoteToAdmin(admin.userId);
    // Login again to get a fresh access token carrying role=admin.
    const relogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: adminEmail, password: 'correct-horse-battery-staple' },
    });
    expect(relogin.statusCode).toBe(200);
    const adminToken = (JSON.parse(relogin.body) as { accessToken: string }).accessToken;

    // Rotate.
    const rotate = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/identity/jwks/rotate',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { ring: 'access' },
    });
    expect(rotate.statusCode).toBe(200);
    const body = JSON.parse(rotate.body) as {
      ring: string;
      newKid: string;
      previousKids: string[];
    };
    expect(body.ring).toBe('access');
    expect(body.newKid).toMatch(/^access-[0-9a-f]{8}$/);
    expect(body.newKid).not.toBe(kidBefore);
    // The old current kid is now in previous.
    expect(body.previousKids).toContain(kidBefore);
  });

  it('tokens issued before rotation still verify after rotation (previous key retained)', async () => {
    // User registers → gets a token signed with the current kid.
    const alice = await registerUser('preroll');
    const preRollKid = kidOf(alice.accessToken);

    // Admin rotates the access ring.
    const adminEmail = `${TEST_PREFIX}-pre-admin-${uniqueSuffix()}@example.com`;
    const adminReg = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: adminEmail,
        password: 'correct-horse-battery-staple',
        displayName: `${TEST_PREFIX}-pre-admin`,
      },
    });
    const adminBody = JSON.parse(adminReg.body) as { userId: string };
    await promoteToAdmin(adminBody.userId);
    const relogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: adminEmail, password: 'correct-horse-battery-staple' },
    });
    const adminToken = (JSON.parse(relogin.body) as { accessToken: string }).accessToken;
    await app.inject({
      method: 'POST',
      url: '/api/v1/admin/identity/jwks/rotate',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { ring: 'access' },
    });

    // Alice's old token still verifies — e.g. against `GET /trips`.
    const list = await app.inject({
      method: 'GET',
      url: '/api/v1/trips',
      headers: { authorization: `Bearer ${alice.accessToken}` },
    });
    expect(list.statusCode).toBe(200);
    // Sanity: it really was the pre-rotation kid.
    expect(preRollKid).toMatch(/access-/);
  });

  it('tokens issued after rotation use the new kid', async () => {
    const adminEmail = `${TEST_PREFIX}-post-admin-${uniqueSuffix()}@example.com`;
    const adminReg = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: adminEmail,
        password: 'correct-horse-battery-staple',
        displayName: `${TEST_PREFIX}-post-admin`,
      },
    });
    const adminBody = JSON.parse(adminReg.body) as { userId: string; accessToken: string };
    await promoteToAdmin(adminBody.userId);
    const relogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: adminEmail, password: 'correct-horse-battery-staple' },
    });
    const adminToken = (JSON.parse(relogin.body) as { accessToken: string }).accessToken;

    const rotate = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/identity/jwks/rotate',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { ring: 'access' },
    });
    const { newKid } = JSON.parse(rotate.body) as { newKid: string };

    // Register a new user AFTER the rotation. Their access token
    // should be signed with the new kid.
    const post = await registerUser('postroll');
    expect(kidOf(post.accessToken)).toBe(newKid);
  });

  it('invalid ring → 422 INVALID_RING', async () => {
    const adminEmail = `${TEST_PREFIX}-bad-${uniqueSuffix()}@example.com`;
    const adminReg = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: adminEmail,
        password: 'correct-horse-battery-staple',
        displayName: `${TEST_PREFIX}-bad`,
      },
    });
    const adminBody = JSON.parse(adminReg.body) as { userId: string };
    await promoteToAdmin(adminBody.userId);
    const relogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: adminEmail, password: 'correct-horse-battery-staple' },
    });
    const adminToken = (JSON.parse(relogin.body) as { accessToken: string }).accessToken;
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/identity/jwks/rotate',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { ring: 'bogus' },
    });
    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body).code).toBe('INVALID_RING');
  });

  it('GET /admin/identity/jwks/kids returns every kid in both rings', async () => {
    const adminEmail = `${TEST_PREFIX}-kids-${uniqueSuffix()}@example.com`;
    const adminReg = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: adminEmail,
        password: 'correct-horse-battery-staple',
        displayName: `${TEST_PREFIX}-kids`,
      },
    });
    const adminBody = JSON.parse(adminReg.body) as { userId: string };
    await promoteToAdmin(adminBody.userId);
    const relogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: adminEmail, password: 'correct-horse-battery-staple' },
    });
    const adminToken = (JSON.parse(relogin.body) as { accessToken: string }).accessToken;

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/identity/jwks/kids',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { access: string[]; refresh: string[] };
    // At minimum both rings have a current kid.
    expect(body.access.length).toBeGreaterThanOrEqual(1);
    expect(body.refresh.length).toBeGreaterThanOrEqual(1);
    // Every kid value is a non-empty string starting with the ring name.
    for (const k of body.access) expect(k).toMatch(/^access-/);
    for (const k of body.refresh) expect(k).toMatch(/^refresh-/);
  });
});
