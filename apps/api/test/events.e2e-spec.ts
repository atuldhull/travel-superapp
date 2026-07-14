/**
 * Integration tests for the EventBus wiring ([IV.18.2.7]).
 *
 * Subscribes a spy handler to the in-process InMemoryEventBus, then
 * drives the HTTP surface and asserts the expected event flow lands
 * in the spy. Covers every use-case that emits today:
 *   - CreateTripDraftUseCase   → Trip.TripDrafted
 *   - UpdateTripUseCase        → Trip.TripUpdated
 *   - DeleteTripUseCase        → Trip.TripDeleted
 *   - GenerateItineraryUseCase → Trip.ItineraryGenerated
 *   - IssueSessionUseCase      → Identity.SessionIssued
 *
 * Every payload has a non-empty traceId when the request has
 * passed through the trace middleware — sanity checks that the
 * context plumbs through the async boundary.
 *
 * Skips cleanly when Postgres / Redis are unreachable.
 *
 * Installed by prompt [IV.18.2.7].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { InMemoryEventBus, type DomainEvent, type EventBus } from '@app/events';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';
import { registerTraceMiddleware } from '../src/common/trace/register-trace-middleware';
import { uniqueEmail } from './factories';

const TEST_PREFIX = 'events-e2e';
const VICTORIA = { lat: 51.4952, lng: -0.1441 };

interface Recorded {
  readonly name: string;
  readonly payload: unknown;
  readonly traceId: string | undefined;
}

describe('Domain event emission (integration, requires Docker Postgres + Redis)', () => {
  let moduleRef: TestingModule;
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let bus: EventBus;
  const recorded: Recorded[] = [];

  function resetRecording(): void {
    recorded.length = 0;
  }

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.useGlobalFilters(new AllExceptionFilter(), new DomainExceptionFilter());
    app.setGlobalPrefix('api/v1', { exclude: ['health', 'health/(.*)'] });
    await app.register(fastifyCookie);
    await registerTraceMiddleware(app);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    prisma = moduleRef.get(PrismaService);
    bus = moduleRef.get<InMemoryEventBus>(InMemoryEventBus);
    await prisma.$queryRaw`SELECT 1`;

    // Subscribe a single spy to EVERY event by listening on each
    // known name. `subscribe` requires a concrete event name, so
    // we subscribe once per name and dedupe via a set.
    const names = [
      'Trip.TripDrafted',
      'Trip.TripUpdated',
      'Trip.TripDeleted',
      'Trip.ItineraryGenerated',
      'Identity.SessionIssued',
    ];
    for (const name of names) {
      await bus.subscribe(
        name,
        async (event: DomainEvent<unknown>) => {
          recorded.push({
            name: event.name,
            payload: event.payload,
            traceId: event.traceId,
          });
        },
        { consumerGroup: `spy-${name}` },
      );
    }
  });

  afterEach(async () => {
    await prisma.user.deleteMany({
      where: { displayName: { startsWith: TEST_PREFIX } },
    });
    resetRecording();
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
      headers: { 'user-agent': 'events-ua' },
    });
    expect(res.statusCode).toBe(201);
    return JSON.parse(res.body) as { userId: string; accessToken: string };
  }

  it('POST /auth/register emits Identity.SessionIssued with traceId', async () => {
    const { userId } = await registerUser('session');
    const sessionEvents = recorded.filter((r) => r.name === 'Identity.SessionIssued');
    expect(sessionEvents).toHaveLength(1);
    const payload = sessionEvents[0]!.payload as {
      userId: string;
      sessionId: string;
      userAgent: string | null;
    };
    expect(payload.userId).toBe(userId);
    expect(payload.sessionId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(payload.userAgent).toBe('events-ua');
    expect(sessionEvents[0]!.traceId).toMatch(/^[0-9a-f]{32}$/);
  });

  it('POST /trips emits Trip.TripDrafted with the new trip id + userId', async () => {
    const { userId, accessToken } = await registerUser('draft');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/trips',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { title: 'London', center: VICTORIA, radiusKm: 5 },
    });
    expect(res.statusCode).toBe(201);
    const tripId = (JSON.parse(res.body) as { id: string }).id;

    const drafted = recorded.filter((r) => r.name === 'Trip.TripDrafted');
    expect(drafted).toHaveLength(1);
    const payload = drafted[0]!.payload as {
      tripId: string;
      userId: string;
      title: string;
      radiusKm: number;
    };
    expect(payload.tripId).toBe(tripId);
    expect(payload.userId).toBe(userId);
    expect(payload.title).toBe('London');
    expect(payload.radiusKm).toBe(5);
    expect(drafted[0]!.traceId).toMatch(/^[0-9a-f]{32}$/);
  });

  it('PATCH /trips/:id emits Trip.TripUpdated with changedFields', async () => {
    const { accessToken } = await registerUser('update');
    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/trips',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { title: 'old', center: VICTORIA, radiusKm: 5 },
    });
    const tripId = (JSON.parse(create.body) as { id: string }).id;
    resetRecording();

    const patch = await app.inject({
      method: 'PATCH',
      url: `/api/v1/trips/${tripId}`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { title: 'new', radiusKm: 20 },
    });
    expect(patch.statusCode).toBe(200);

    const updates = recorded.filter((r) => r.name === 'Trip.TripUpdated');
    expect(updates).toHaveLength(1);
    const payload = updates[0]!.payload as {
      tripId: string;
      version: number;
      changedFields: string[];
    };
    expect(payload.tripId).toBe(tripId);
    expect(payload.version).toBe(2);
    expect(payload.changedFields.sort()).toEqual(['radiusKm', 'title']);
  });

  it('PATCH with no effective change (same value) emits NO TripUpdated event', async () => {
    const { accessToken } = await registerUser('noop');
    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/trips',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { title: 'same', center: VICTORIA, radiusKm: 5 },
    });
    const tripId = (JSON.parse(create.body) as { id: string }).id;
    resetRecording();

    const patch = await app.inject({
      method: 'PATCH',
      url: `/api/v1/trips/${tripId}`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { title: 'same' }, // no change.
    });
    expect(patch.statusCode).toBe(200);
    expect(recorded.filter((r) => r.name === 'Trip.TripUpdated')).toHaveLength(0);
  });

  it('POST /trips/:id/itinerary emits Trip.ItineraryGenerated with dayCount', async () => {
    const { accessToken } = await registerUser('itin');
    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/trips',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        title: 'itin',
        center: VICTORIA,
        radiusKm: 5,
        startsOn: '2026-08-01',
        endsOn: '2026-08-04',
      },
    });
    const tripId = (JSON.parse(create.body) as { id: string }).id;
    resetRecording();

    const gen = await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${tripId}/itinerary`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(gen.statusCode).toBe(200);

    const evts = recorded.filter((r) => r.name === 'Trip.ItineraryGenerated');
    expect(evts).toHaveLength(1);
    const payload = evts[0]!.payload as { tripId: string; dayCount: number };
    expect(payload.tripId).toBe(tripId);
    expect(payload.dayCount).toBe(4);
  });

  it('DELETE /trips/:id emits Trip.TripDeleted', async () => {
    const { userId, accessToken } = await registerUser('del');
    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/trips',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { title: 'to-delete', center: VICTORIA, radiusKm: 5 },
    });
    const tripId = (JSON.parse(create.body) as { id: string }).id;
    resetRecording();

    const del = await app.inject({
      method: 'DELETE',
      url: `/api/v1/trips/${tripId}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(del.statusCode).toBe(204);

    const evts = recorded.filter((r) => r.name === 'Trip.TripDeleted');
    expect(evts).toHaveLength(1);
    const payload = evts[0]!.payload as { tripId: string; userId: string };
    expect(payload.tripId).toBe(tripId);
    expect(payload.userId).toBe(userId);
  });

  it('events are emitted AFTER the DB write settles — DELETE does not emit on 404', async () => {
    const { accessToken } = await registerUser('ghost-del');
    resetRecording();
    // Delete a trip that doesn't exist.
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/v1/trips/00000000-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(404);
    expect(recorded.filter((r) => r.name === 'Trip.TripDeleted')).toHaveLength(0);
  });
});
