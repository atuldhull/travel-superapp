/**
 * Integration tests for the planner-instruction surface (Phase 2 polish F1):
 *
 *   POST /api/v1/trips/:id/plan-with-ai
 *   GET  /api/v1/trips/:id/center
 *
 * Both routes were shipped in Phase 2 / Phase 2 polish without an
 * integration test — only the api `tsc` build was the gate. This
 * suite stubs the `TRIP_PLANNER_PORT` so we can assert the
 * controller faithfully threads the body's optional `instruction`
 * into the port call, AND covers the existence-probe / owner-gate
 * behaviour on both routes.
 *
 * Mirror of the `trip-weather.e2e-spec.ts` shape so it slots into
 * the same DB-up gate / cleanup harness.
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';
import {
  TRIP_PLANNER_PORT,
  type TripPlannerPort,
  type TripPlannerRequest,
  type TripPlannerResult,
} from '../src/modules/trip/application/ports/trip-planner.port';
import { uniqueEmail } from './factories';

const TEST_PREFIX = 'plan-with-ai-e2e';
// Suite-local coord far from any other test's Place rows.
const REMOTE = { lat: 12.3456, lng: -45.6789 };

class StubPlanner implements TripPlannerPort {
  public calls: TripPlannerRequest[] = [];

  reset(): void {
    this.calls = [];
  }

  async generatePlan(request: TripPlannerRequest): Promise<TripPlannerResult> {
    this.calls.push(request);
    return {
      plan: `STUB plan for ${request.title}`,
      model: 'stub-test',
      provider: 'stub',
    };
  }
}

describe('Trip × plan-with-ai + center (integration, requires Docker Postgres)', () => {
  let moduleRef: TestingModule;
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let stub: StubPlanner;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(TRIP_PLANNER_PORT)
      .useValue(new StubPlanner())
      .compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.useGlobalFilters(new AllExceptionFilter(), new DomainExceptionFilter());
    app.setGlobalPrefix('api/v1', { exclude: ['health', 'health/(.*)'] });
    await app.register(fastifyCookie);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    prisma = moduleRef.get(PrismaService);
    stub = moduleRef.get<StubPlanner>(TRIP_PLANNER_PORT);
    await prisma.$queryRaw`SELECT 1`;
  });

  afterEach(async () => {
    stub.reset();
    await prisma.user.deleteMany({
      where: { displayName: { startsWith: TEST_PREFIX } },
    });
  });

  afterAll(async () => {
    await app.close();
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

  async function createTrip(accessToken: string): Promise<{ id: string }> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/trips',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        title: 'F1 plan trip',
        center: REMOTE,
        radiusKm: 5,
      },
    });
    expect(res.statusCode).toBe(201);
    return { id: (JSON.parse(res.body) as { id: string }).id };
  }

  describe('POST /trips/:id/plan-with-ai', () => {
    it('threads body.instruction into the planner port', async () => {
      const { accessToken } = await registerUser('inst');
      const trip = await createTrip(accessToken);

      const instruction = 'Make it family-friendly with a slower pace.';
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/trips/${trip.id}/plan-with-ai`,
        headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
        payload: { instruction },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body) as TripPlannerResult;
      expect(body.provider).toBe('stub');
      expect(body.plan).toContain('F1 plan trip');

      expect(stub.calls).toHaveLength(1);
      expect(stub.calls[0]!.instruction).toBe(instruction);
      expect(stub.calls[0]!.title).toBe('F1 plan trip');
      expect(stub.calls[0]!.center.lat).toBeCloseTo(REMOTE.lat, 4);
      expect(stub.calls[0]!.center.lng).toBeCloseTo(REMOTE.lng, 4);
    });

    it('tolerates a bodyless call (the onboarding caller pattern)', async () => {
      const { accessToken } = await registerUser('nobody');
      const trip = await createTrip(accessToken);

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/trips/${trip.id}/plan-with-ai`,
        headers: { authorization: `Bearer ${accessToken}` },
        // No payload at all — must not throw.
      });
      expect(res.statusCode).toBe(200);
      expect(stub.calls).toHaveLength(1);
      expect(stub.calls[0]!.instruction).toBeUndefined();
    });

    it('tolerates a garbage body and ignores the instruction', async () => {
      const { accessToken } = await registerUser('garbage');
      const trip = await createTrip(accessToken);

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/trips/${trip.id}/plan-with-ai`,
        headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
        payload: { instruction: 12345, unrelated: { nested: true } },
      });
      expect(res.statusCode).toBe(200);
      expect(stub.calls).toHaveLength(1);
      // The schema rejects non-string instruction → controller treats
      // it as absent rather than throwing.
      expect(stub.calls[0]!.instruction).toBeUndefined();
    });

    it('trims + caps instruction at 600 chars before threading', async () => {
      const { accessToken } = await registerUser('cap');
      const trip = await createTrip(accessToken);

      // 800 chars padded with spaces; expect trimmed-then-sliced to 600.
      const long = '  ' + 'A'.repeat(800) + '  ';
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/trips/${trip.id}/plan-with-ai`,
        headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
        payload: { instruction: long },
      });
      // The zod schema's .max(600) rejects 800-char strings → the
      // controller's safeParse falls back to `instruction = undefined`,
      // matching the documented "tolerates garbage body" contract.
      expect(res.statusCode).toBe(200);
      expect(stub.calls).toHaveLength(1);
      expect(stub.calls[0]!.instruction).toBeUndefined();
    });

    it('non-owner → 404 TRIP_NOT_FOUND (IDOR defence)', async () => {
      const alice = await registerUser('alice');
      const bob = await registerUser('bob');
      const trip = await createTrip(alice.accessToken);

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/trips/${trip.id}/plan-with-ai`,
        headers: { authorization: `Bearer ${bob.accessToken}` },
      });
      expect(res.statusCode).toBe(404);
      expect(JSON.parse(res.body).code).toBe('TRIP_NOT_FOUND');
      expect(stub.calls).toHaveLength(0);
    });

    it('unauthenticated → 401 UNAUTHENTICATED', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/trips/whatever/plan-with-ai',
      });
      expect(res.statusCode).toBe(401);
      expect(JSON.parse(res.body).code).toBe('UNAUTHENTICATED');
      expect(stub.calls).toHaveLength(0);
    });
  });

  describe('GET /trips/:id/center (Phase 2 polish F2)', () => {
    it('returns the trip center coords', async () => {
      const { accessToken } = await registerUser('center');
      const trip = await createTrip(accessToken);

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/trips/${trip.id}/center`,
        headers: { authorization: `Bearer ${accessToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body) as { lat: number; lng: number };
      expect(body.lat).toBeCloseTo(REMOTE.lat, 4);
      expect(body.lng).toBeCloseTo(REMOTE.lng, 4);
    });

    it('non-owner → 404 TRIP_NOT_FOUND', async () => {
      const alice = await registerUser('center-alice');
      const bob = await registerUser('center-bob');
      const trip = await createTrip(alice.accessToken);

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/trips/${trip.id}/center`,
        headers: { authorization: `Bearer ${bob.accessToken}` },
      });
      expect(res.statusCode).toBe(404);
      expect(JSON.parse(res.body).code).toBe('TRIP_NOT_FOUND');
    });

    it('unauthenticated → 401 UNAUTHENTICATED', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/trips/whatever/center',
      });
      expect(res.statusCode).toBe(401);
      expect(JSON.parse(res.body).code).toBe('UNAUTHENTICATED');
    });
  });
});
