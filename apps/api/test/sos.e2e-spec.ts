/**
 * Integration tests for the Safety SOS endpoints ([IV.18.11.2]).
 *
 * Exercises the three primitives: trigger, list-mine, resolve.
 * IDOR defence: stranger can't resolve someone else's SOS.
 *
 * Installed by prompt [IV.18.11.2].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';
import { uniqueEmail } from './factories';

const TEST_PREFIX = 'sos-e2e';
// Suite-local coord.
const REMOTE = { lat: -32.7654, lng: 42.1234 };

describe('Safety SOS (integration, requires Docker Postgres)', () => {
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
      console.warn(`sos test: DB not reachable (${message}). Skipping.`);
      dbReachable = false;
    }
  });

  afterEach(async () => {
    // User cascade-deletes the SosEvent rows.
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

  async function registerUser(suffix: string): Promise<{
    userId: string;
    accessToken: string;
  }> {
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

  it('POST /safety/sos without a bearer → 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/safety/sos',
      payload: { center: REMOTE, trigger: 'user_tap' },
    });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).code).toBe('UNAUTHENTICATED');
  });

  it('trigger → list finds it (unresolved); resolve → list shows resolvedAt', async () => {
    const { userId, accessToken } = await registerUser('flow');

    const triggered = await app.inject({
      method: 'POST',
      url: '/api/v1/safety/sos',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { center: REMOTE, trigger: 'user_tap' },
    });
    expect(triggered.statusCode).toBe(201);
    const created = JSON.parse(triggered.body) as {
      id: string;
      userId: string;
      trigger: string;
      resolvedAt: string | null;
      createdAt: string;
    };
    expect(created.userId).toBe(userId);
    expect(created.trigger).toBe('user_tap');
    expect(created.resolvedAt).toBeNull();

    // List shows it.
    const listed = await app.inject({
      method: 'GET',
      url: '/api/v1/safety/sos',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(listed.statusCode).toBe(200);
    const listBody = JSON.parse(listed.body) as {
      events: Array<{ id: string; resolvedAt: string | null }>;
    };
    expect(listBody.events).toHaveLength(1);
    expect(listBody.events[0]!.id).toBe(created.id);
    expect(listBody.events[0]!.resolvedAt).toBeNull();

    // Resolve it.
    const resolved = await app.inject({
      method: 'POST',
      url: `/api/v1/safety/sos/${created.id}/resolve`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { note: 'False alarm, was meeting friends' },
    });
    expect(resolved.statusCode).toBe(200);
    const resolvedBody = JSON.parse(resolved.body) as {
      resolvedAt: string | null;
      resolutionNote: string | null;
    };
    expect(resolvedBody.resolvedAt).not.toBeNull();
    expect(resolvedBody.resolutionNote).toBe('False alarm, was meeting friends');

    // Re-list — still there, now with resolvedAt set.
    const listed2 = await app.inject({
      method: 'GET',
      url: '/api/v1/safety/sos',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const list2 = JSON.parse(listed2.body) as {
      events: Array<{ resolvedAt: string | null }>;
    };
    expect(list2.events[0]!.resolvedAt).not.toBeNull();
  });

  it('list returns only my own SOS events (no cross-user leak)', async () => {
    const alice = await registerUser('alice');
    const bob = await registerUser('bob');

    await app.inject({
      method: 'POST',
      url: '/api/v1/safety/sos',
      headers: { authorization: `Bearer ${alice.accessToken}` },
      payload: { center: REMOTE, trigger: 'alice_tap' },
    });
    await app.inject({
      method: 'POST',
      url: '/api/v1/safety/sos',
      headers: { authorization: `Bearer ${bob.accessToken}` },
      payload: { center: REMOTE, trigger: 'bob_tap' },
    });

    const aliceList = await app.inject({
      method: 'GET',
      url: '/api/v1/safety/sos',
      headers: { authorization: `Bearer ${alice.accessToken}` },
    });
    const body = JSON.parse(aliceList.body) as {
      events: Array<{ trigger: string; userId: string }>;
    };
    expect(body.events).toHaveLength(1);
    expect(body.events[0]!.trigger).toBe('alice_tap');
    expect(body.events[0]!.userId).toBe(alice.userId);
  });

  it('resolve by non-owner → 404 SOS_NOT_FOUND (IDOR defence)', async () => {
    const alice = await registerUser('a-idor');
    const bob = await registerUser('b-idor');

    const triggered = await app.inject({
      method: 'POST',
      url: '/api/v1/safety/sos',
      headers: { authorization: `Bearer ${alice.accessToken}` },
      payload: { center: REMOTE, trigger: 'user_tap' },
    });
    const id = (JSON.parse(triggered.body) as { id: string }).id;

    // Bob tries to resolve Alice's SOS.
    const attempt = await app.inject({
      method: 'POST',
      url: `/api/v1/safety/sos/${id}/resolve`,
      headers: { authorization: `Bearer ${bob.accessToken}` },
      payload: {},
    });
    expect(attempt.statusCode).toBe(404);
    expect(JSON.parse(attempt.body).code).toBe('SOS_NOT_FOUND');

    // Still unresolved for Alice.
    const aliceList = await app.inject({
      method: 'GET',
      url: '/api/v1/safety/sos',
      headers: { authorization: `Bearer ${alice.accessToken}` },
    });
    const aliceBody = JSON.parse(aliceList.body) as {
      events: Array<{ resolvedAt: string | null }>;
    };
    expect(aliceBody.events[0]!.resolvedAt).toBeNull();
  });

  it('resolve twice → second call returns 404 (already resolved)', async () => {
    const { accessToken } = await registerUser('twice');

    const triggered = await app.inject({
      method: 'POST',
      url: '/api/v1/safety/sos',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { center: REMOTE, trigger: 'user_tap' },
    });
    const id = (JSON.parse(triggered.body) as { id: string }).id;

    const first = await app.inject({
      method: 'POST',
      url: `/api/v1/safety/sos/${id}/resolve`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {},
    });
    expect(first.statusCode).toBe(200);

    const second = await app.inject({
      method: 'POST',
      url: `/api/v1/safety/sos/${id}/resolve`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {},
    });
    expect(second.statusCode).toBe(404);
    expect(JSON.parse(second.body).code).toBe('SOS_NOT_FOUND');
  });

  it('resolve unknown id → 404 SOS_NOT_FOUND', async () => {
    const { accessToken } = await registerUser('missing');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/safety/sos/does-not-exist/resolve',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {},
    });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).code).toBe('SOS_NOT_FOUND');
  });

  it('lat out of range → 422 VALIDATION_FAILED (Zod)', async () => {
    const { accessToken } = await registerUser('bad-lat');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/safety/sos',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { center: { lat: 999, lng: 0 }, trigger: 'user_tap' },
    });
    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body).code).toBe('VALIDATION_FAILED');
  });
});
