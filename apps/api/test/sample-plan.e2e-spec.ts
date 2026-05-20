/**
 * Integration tests for `POST /api/v1/trips/sample-plan` — the
 * public, no-auth chatbot endpoint that the landing demo + the
 * GlobalAssistant call. The original Phase 2 polish (F1) covered
 * the AUTHED `/plan-with-ai` route; this one closes the gap for
 * the public surface.
 *
 * Stubs `TRIP_PLANNER_PORT` to assert the controller faithfully
 * threads the body fields (title / center / radiusKm / instruction
 * / priorPlan) into the port call. NEVER hits a real LLM.
 *
 * Installed for Phase 2 polish (F16).
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

class StubPlanner implements TripPlannerPort {
  public calls: TripPlannerRequest[] = [];

  reset(): void {
    this.calls = [];
  }

  async generatePlan(request: TripPlannerRequest): Promise<TripPlannerResult> {
    this.calls.push(request);
    return {
      plan: `STUB plan for ${request.title} at ${request.center.lat},${request.center.lng}`,
      model: 'stub-test',
      provider: 'stub',
    };
  }
}

describe('Trip × sample-plan (public, integration)', () => {
  let moduleRef: TestingModule;
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let stub: StubPlanner;
  let dbReachable = true;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(TRIP_PLANNER_PORT)
      .useValue(new StubPlanner())
      .compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.useGlobalFilters(new AllExceptionFilter(), new DomainExceptionFilter());
    app.setGlobalPrefix('api/v1', { exclude: ['health', 'health/(.*)'] });
    await app.register(fastifyCookie);
    try {
      await app.init();
      await app.getHttpAdapter().getInstance().ready();
      prisma = moduleRef.get(PrismaService);
      stub = moduleRef.get<StubPlanner>(TRIP_PLANNER_PORT);
      await prisma.$queryRaw`SELECT 1`;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // eslint-disable-next-line no-console
      console.warn(`sample-plan test: DB not reachable (${message}). Skipping.`);
      dbReachable = false;
    }
  });

  afterEach(() => {
    if (dbReachable) stub.reset();
  });

  afterAll(async () => {
    if (dbReachable) await app.close();
    await moduleRef.close();
  });

  const BODY = {
    title: 'Lisbon weekend',
    center: { lat: 38.7223, lng: -9.1393 },
    radiusKm: 20,
  };

  it('200 with no auth + threads body into the planner port', async () => {
    if (!dbReachable) return;
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/trips/sample-plan',
      headers: { 'content-type': 'application/json' },
      payload: BODY,
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as TripPlannerResult;
    expect(body.provider).toBe('stub');
    expect(body.plan).toContain('Lisbon weekend');

    expect(stub.calls).toHaveLength(1);
    const call = stub.calls[0]!;
    expect(call.title).toBe('Lisbon weekend');
    expect(call.center.lat).toBeCloseTo(BODY.center.lat, 4);
    expect(call.center.lng).toBeCloseTo(BODY.center.lng, 4);
    expect(call.radiusKm).toBe(20);
    expect(call.instruction).toBeUndefined();
    expect(call.priorPlan).toBeUndefined();
  });

  it('threads optional instruction + priorPlan into the planner port (refine path)', async () => {
    if (!dbReachable) return;
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/trips/sample-plan',
      headers: { 'content-type': 'application/json' },
      payload: {
        ...BODY,
        instruction: 'Make it cheaper and slower-paced.',
        priorPlan: 'Day 1 — markets. Day 2 — castle.',
      },
    });
    expect(res.statusCode).toBe(200);
    expect(stub.calls).toHaveLength(1);
    expect(stub.calls[0]!.instruction).toBe('Make it cheaper and slower-paced.');
    expect(stub.calls[0]!.priorPlan).toBe('Day 1 — markets. Day 2 — castle.');
  });

  it('422 INVALID_INPUT on missing center', async () => {
    if (!dbReachable) return;
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/trips/sample-plan',
      headers: { 'content-type': 'application/json' },
      payload: { title: 'No center', radiusKm: 20 },
    });
    expect(res.statusCode).toBe(422);
    expect(stub.calls).toHaveLength(0);
  });

  it('422 INVALID_INPUT on radiusKm > 200', async () => {
    if (!dbReachable) return;
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/trips/sample-plan',
      headers: { 'content-type': 'application/json' },
      payload: { ...BODY, radiusKm: 999 },
    });
    expect(res.statusCode).toBe(422);
    expect(stub.calls).toHaveLength(0);
  });

  it('422 INVALID_INPUT on instruction > 400 chars', async () => {
    if (!dbReachable) return;
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/trips/sample-plan',
      headers: { 'content-type': 'application/json' },
      payload: { ...BODY, instruction: 'x'.repeat(401) },
    });
    expect(res.statusCode).toBe(422);
    expect(stub.calls).toHaveLength(0);
  });
});
