/**
 * Integration tests for the admin SOS dashboard ([IV.18.18.2]).
 *
 *   GET  /admin/safety/sos-events?status=&limit=&offset=
 *   POST /admin/safety/sos-events/:id/resolve
 *
 * Cross-user list (no userId scope — admin sees ALL events).
 * Status filter narrows to active or resolved. The resolve
 * endpoint mirrors the user-self-resolve pattern but without
 * the owner gate.
 *
 * Installed by prompt [IV.18.18.2].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';

const TEST_PREFIX = 'admin-sos-e2e';
// Suite-local Atlantic coord — no overlap with other safety suites.
const COORD = { lat: 13.4567, lng: -42.1234 };

interface SosEventResp {
  id: string;
  userId: string;
  trigger: string;
  resolvedAt: string | null;
  resolutionNote: string | null;
  createdAt: string;
}

interface ListResp {
  events: SosEventResp[];
  total: number;
}

describe('Admin SOS dashboard (integration, requires Docker Postgres)', () => {
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
      console.warn(`admin-sos test: DB not reachable (${message}). Skipping.`);
      dbReachable = false;
    }
  });

  afterEach(async () => {
    if (!dbReachable) return;
    // User cascade-deletes SosEvent rows.
    await prisma.user.deleteMany({
      where: { displayName: { startsWith: TEST_PREFIX } },
    });
  });

  afterAll(async () => {
    if (dbReachable) await app.close();
    await moduleRef.close();
  });

  async function registerUser(suffix: string): Promise<{
    userId: string;
    accessToken: string;
    email: string;
    password: string;
  }> {
    const email = `${TEST_PREFIX}-${suffix}-${Date.now()}@example.com`;
    const password = 'correct-horse-battery-staple';
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email, password, displayName: `${TEST_PREFIX}-${suffix}` },
    });
    expect(res.statusCode).toBe(201);
    return {
      ...(JSON.parse(res.body) as { userId: string; accessToken: string }),
      email,
      password,
    };
  }

  async function loginAsAdmin(suffix: string): Promise<string> {
    const reg = await registerUser(suffix);
    await prisma.user.update({ where: { id: reg.userId }, data: { role: 'admin' } });
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: reg.email, password: reg.password },
    });
    expect(login.statusCode).toBe(200);
    return (JSON.parse(login.body) as { accessToken: string }).accessToken;
  }

  async function triggerSos(token: string): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/safety/sos',
      headers: { authorization: `Bearer ${token}` },
      payload: { center: COORD, trigger: 'user_tap' },
    });
    expect(res.statusCode).toBe(201);
    return (JSON.parse(res.body) as { id: string }).id;
  }

  async function adminList(token: string, query = ''): Promise<ListResp> {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/safety/sos-events${query}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    return JSON.parse(res.body) as ListResp;
  }

  it('GET /admin/safety/sos-events without bearer → 401', async () => {
    if (!dbReachable) return;
    const res = await app.inject({ method: 'GET', url: '/api/v1/admin/safety/sos-events' });
    expect(res.statusCode).toBe(401);
  });

  it('non-admin → 403', async () => {
    if (!dbReachable) return;
    const { accessToken } = await registerUser('non-admin');
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/safety/sos-events',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('?status=active returns only unresolved events; admin sees ALL users’ events', async () => {
    if (!dbReachable) return;
    const adminToken = await loginAsAdmin('list-admin');
    const alice = await registerUser('alice');
    const bob = await registerUser('bob');
    const aliceSosId = await triggerSos(alice.accessToken);
    const bobSosId = await triggerSos(bob.accessToken);
    // Resolve Alice's via her self-endpoint.
    await app.inject({
      method: 'POST',
      url: `/api/v1/safety/sos/${aliceSosId}/resolve`,
      headers: { authorization: `Bearer ${alice.accessToken}` },
      payload: {},
    });

    const body = await adminList(adminToken, '?status=active');
    // Bob's row should appear; Alice's should not.
    const ids = body.events.map((e) => e.id);
    expect(ids).toContain(bobSosId);
    expect(ids).not.toContain(aliceSosId);
    // Every returned row is unresolved.
    for (const e of body.events) expect(e.resolvedAt).toBeNull();
  });

  it('?status=resolved returns only resolved events', async () => {
    if (!dbReachable) return;
    const adminToken = await loginAsAdmin('resolved-filter');
    const alice = await registerUser('alice-r');
    const bob = await registerUser('bob-r');
    const aliceSosId = await triggerSos(alice.accessToken);
    const bobSosId = await triggerSos(bob.accessToken);
    await app.inject({
      method: 'POST',
      url: `/api/v1/safety/sos/${aliceSosId}/resolve`,
      headers: { authorization: `Bearer ${alice.accessToken}` },
      payload: { note: 'false alarm' },
    });

    const body = await adminList(adminToken, '?status=resolved');
    const ids = body.events.map((e) => e.id);
    expect(ids).toContain(aliceSosId);
    expect(ids).not.toContain(bobSosId);
    for (const e of body.events) expect(e.resolvedAt).not.toBeNull();
  });

  it('unknown status → 400 VALIDATION_FAILED', async () => {
    if (!dbReachable) return;
    const adminToken = await loginAsAdmin('bad-status');
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/safety/sos-events?status=bogus',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).code).toBe('VALIDATION_FAILED');
  });

  it('admin resolve sets resolvedAt + note on someone else’s SOS', async () => {
    if (!dbReachable) return;
    const adminToken = await loginAsAdmin('resolver');
    const target = await registerUser('target');
    const sosId = await triggerSos(target.accessToken);

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/safety/sos-events/${sosId}/resolve`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { note: 'support agent confirmed user is safe' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as SosEventResp;
    expect(body.id).toBe(sosId);
    expect(body.resolvedAt).not.toBeNull();
    expect(body.resolutionNote).toBe('support agent confirmed user is safe');

    // Sanity in DB.
    const row = await prisma.sosEvent.findUnique({ where: { id: sosId } });
    expect(row!.resolvedAt).not.toBeNull();
  });

  it('admin resolve on already-resolved → 404 SOS_NOT_FOUND', async () => {
    if (!dbReachable) return;
    const adminToken = await loginAsAdmin('double-resolve');
    const target = await registerUser('target-dr');
    const sosId = await triggerSos(target.accessToken);

    // First resolve succeeds.
    const first = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/safety/sos-events/${sosId}/resolve`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {},
    });
    expect(first.statusCode).toBe(200);

    // Second resolve → 404.
    const second = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/safety/sos-events/${sosId}/resolve`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {},
    });
    expect(second.statusCode).toBe(404);
    expect(JSON.parse(second.body).code).toBe('SOS_NOT_FOUND');
  });
});
