/**
 * Integration tests for the V.UX.24 agent persona surfaces.
 *
 *   - GET /api/v1/agent/me              (profile, gated to agent role)
 *   - PATCH /api/v1/agent/me            (partial update)
 *   - GET /api/v1/agent/me/dashboard    (composite)
 *   - POST /api/v1/reviews/:id/response (one-shot agent reply)
 *
 *   1. Non-agent role → 403 ROLE_FORBIDDEN on /agent/me.
 *   2. Agent role w/ no Agent row → 404 AGENT_PROFILE_NOT_FOUND.
 *   3. Agent w/ row → profile round-trips bio + languages + regions.
 *   4. Dashboard composite returns the seeded EscrowHold + earnings
 *      sum + the seeded Review.
 *   5. POST /reviews/:id/response sets the reply once; second call →
 *      409 REVIEW_RESPONSE_LOCKED.
 *   6. POST /reviews/:id/response on a non-agent review → 403.
 *
 * Installed by prompt [V.UX.24].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';
import { uniqueEmail, uniqueSuffix } from './factories';

const TEST_PREFIX = 'agent-dashboard-e2e';

interface RegisterRes {
  userId: string;
  accessToken: string;
}

interface AgentProfileBody {
  id: string;
  userId: string;
  displayName: string;
  bio: string | null;
  kycStatus: string;
  languages: string[];
  regions: string[];
}

interface AgentDashboardBody {
  profile: AgentProfileBody;
  bookings: Array<{ id: string; amountUsd: string; state: string }>;
  earnings: { grossUsd: string; bookingsCount: number };
  reviews: Array<{ id: string; rating: number; responseBody: string | null }>;
  windowDays: number;
}

interface ReviewBody {
  id: string;
  responseBody: string | null;
  responseAt: string | null;
}

describe('V.UX.24 agent dashboard + review response (integration, requires Docker Postgres)', () => {
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
      console.warn(`agent-dashboard test: DB not reachable (${message}). Skipping.`);
      dbReachable = false;
    }
  });

  afterEach(async () => {
    await prisma.review.deleteMany({ where: { body: { startsWith: TEST_PREFIX } } });
    await prisma.escrowHold.deleteMany({
      where: { stripePaymentIntent: { startsWith: TEST_PREFIX } },
    });
    await prisma.agent.deleteMany({ where: { displayName: { startsWith: TEST_PREFIX } } });
    await prisma.user.deleteMany({ where: { displayName: { startsWith: TEST_PREFIX } } });
  });

  afterAll(async () => {
    if (dbReachable) await app.close();
    await moduleRef.close();
  });

  async function registerAndGetToken(suffix: string): Promise<RegisterRes & { email: string }> {
    const email = uniqueEmail(`${TEST_PREFIX}-${suffix}`);
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
    const body = JSON.parse(res.body) as RegisterRes;
    return { ...body, email };
  }

  // Flips the User.role + re-issues an access token (the original
  // token still carries `role: 'user'` and would 403 against the
  // RolesGuard). RolesGuard reads the JWT claim, not the DB row.
  async function promoteToAgentAndRelogin(opts: {
    userId: string;
    email: string;
  }): Promise<string> {
    await prisma.user.update({ where: { id: opts.userId }, data: { role: 'agent' } });
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: opts.email, password: 'correct-horse-battery-staple' },
    });
    expect(res.statusCode).toBe(200);
    return (JSON.parse(res.body) as { accessToken: string }).accessToken;
  }

  async function seedAgentRow(opts: {
    userId: string;
    suffix: string;
    languages?: string[];
    regions?: string[];
  }): Promise<string> {
    const row = await prisma.agent.create({
      data: {
        userId: opts.userId,
        displayName: `${TEST_PREFIX}-${opts.suffix}`,
        bio: 'Seasoned local guide.',
        kycStatus: 'verified',
        verifiedAt: new Date(),
        languages: opts.languages ?? ['en'],
        regions: opts.regions ?? ['Lisbon'],
        ratingAverage: 4.5,
        ratingCount: 12,
      },
    });
    return row.id;
  }

  // 1. Non-agent role on /agent/me → 403.
  it('Non-agent caller hits 403 ROLE_FORBIDDEN on /agent/me', async () => {
    const { accessToken } = await registerAndGetToken('basic');
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/agent/me',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body).code).toBe('ROLE_FORBIDDEN');
  });

  // 2. Agent role w/ no Agent row → 404 AGENT_PROFILE_NOT_FOUND.
  it('Agent role w/o an Agent row → 404 AGENT_PROFILE_NOT_FOUND', async () => {
    const u = await registerAndGetToken('orphan-agent');
    const token = await promoteToAgentAndRelogin({ userId: u.userId, email: u.email });
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/agent/me',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).code).toBe('AGENT_PROFILE_NOT_FOUND');
  });

  // 3. Profile round-trip via PATCH.
  it('GET + PATCH /agent/me round-trips bio + languages + regions', async () => {
    const u = await registerAndGetToken('full');
    const token = await promoteToAgentAndRelogin({ userId: u.userId, email: u.email });
    await seedAgentRow({ userId: u.userId, suffix: 'full' });

    const get1 = await app.inject({
      method: 'GET',
      url: '/api/v1/agent/me',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(get1.statusCode).toBe(200);
    expect((JSON.parse(get1.body) as AgentProfileBody).languages).toEqual(['en']);

    const patch = await app.inject({
      method: 'PATCH',
      url: '/api/v1/agent/me',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        bio: 'Updated bio about local food.',
        languages: ['en', 'pt'],
        regions: ['Lisbon', 'Porto'],
      },
    });
    expect(patch.statusCode).toBe(200);
    const updated = JSON.parse(patch.body) as AgentProfileBody;
    expect(updated.bio).toBe('Updated bio about local food.');
    expect(updated.languages).toEqual(['en', 'pt']);
    expect(updated.regions).toEqual(['Lisbon', 'Porto']);
  });

  // 4. Dashboard composite.
  it('GET /agent/me/dashboard returns booking + earnings sum + review', async () => {
    const guest = await registerAndGetToken('guest');
    const u = await registerAndGetToken('dash');
    const token = await promoteToAgentAndRelogin({ userId: u.userId, email: u.email });
    const agentId = await seedAgentRow({ userId: u.userId, suffix: 'dash' });

    // Seed an EscrowHold for the agent (state=released, $250).
    await prisma.escrowHold.create({
      data: {
        userId: guest.userId,
        agentId,
        amountUsd: '250.00',
        currency: 'USD',
        stripePaymentIntent: `${TEST_PREFIX}-pi-${uniqueSuffix()}`,
        state: 'released',
      },
    });
    // Seed a Review of the agent.
    await prisma.review.create({
      data: {
        authorId: guest.userId,
        targetType: 'agent',
        targetId: agentId,
        rating: 5,
        body: `${TEST_PREFIX}-dash-review`,
      },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/agent/me/dashboard',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as AgentDashboardBody;
    expect(body.profile.id).toBe(agentId);
    expect(body.bookings).toHaveLength(1);
    expect(body.bookings[0]!.amountUsd).toBe('250.00');
    expect(body.earnings.bookingsCount).toBe(1);
    expect(body.earnings.grossUsd).toBe('250.00');
    expect(body.reviews).toHaveLength(1);
    expect(body.reviews[0]!.rating).toBe(5);
    expect(body.windowDays).toBe(30);
  });

  // 5. POST /reviews/:id/response — happy path then 409 on re-submit.
  it('Review response is one-shot (second call → 409 REVIEW_RESPONSE_LOCKED)', async () => {
    const guest = await registerAndGetToken('rev-guest');
    const u = await registerAndGetToken('rev-agent');
    const token = await promoteToAgentAndRelogin({ userId: u.userId, email: u.email });
    const agentId = await seedAgentRow({ userId: u.userId, suffix: 'rev' });

    const review = await prisma.review.create({
      data: {
        authorId: guest.userId,
        targetType: 'agent',
        targetId: agentId,
        rating: 4,
        body: `${TEST_PREFIX}-rev-body`,
      },
    });

    const first = await app.inject({
      method: 'POST',
      url: `/api/v1/reviews/${review.id}/response`,
      headers: { authorization: `Bearer ${token}` },
      payload: { responseBody: 'Thanks for the kind words!' },
    });
    expect(first.statusCode).toBe(200);
    const updated = JSON.parse(first.body) as ReviewBody;
    expect(updated.responseBody).toBe('Thanks for the kind words!');
    expect(updated.responseAt).not.toBeNull();

    const second = await app.inject({
      method: 'POST',
      url: `/api/v1/reviews/${review.id}/response`,
      headers: { authorization: `Bearer ${token}` },
      payload: { responseBody: 'Trying to edit my reply.' },
    });
    expect(second.statusCode).toBe(409);
    expect(JSON.parse(second.body).code).toBe('REVIEW_RESPONSE_LOCKED');
  });

  // 6. Cross-agent / wrong-target → 403.
  it('Responding to a review that is not about the caller → 403 REVIEW_RESPONSE_FORBIDDEN', async () => {
    const guest = await registerAndGetToken('xa-guest');
    const u = await registerAndGetToken('xa-agent');
    const token = await promoteToAgentAndRelogin({ userId: u.userId, email: u.email });
    await seedAgentRow({ userId: u.userId, suffix: 'xa' });

    // Review targets a *different* agent (random cuid).
    const review = await prisma.review.create({
      data: {
        authorId: guest.userId,
        targetType: 'agent',
        targetId: 'cl000someother00000agentid',
        rating: 3,
        body: `${TEST_PREFIX}-xa-body`,
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/reviews/${review.id}/response`,
      headers: { authorization: `Bearer ${token}` },
      payload: { responseBody: 'Not my review!' },
    });
    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body).code).toBe('REVIEW_RESPONSE_FORBIDDEN');
  });
});
