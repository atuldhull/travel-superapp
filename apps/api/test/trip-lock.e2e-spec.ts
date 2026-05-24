/**
 * Integration tests for `POST /trips/:id/lock` + `POST /trips/:id/unlock`
 * + the share-collaborator-edit gate ([V.UX.8]). Owner-only verbs.
 *
 * "Locked" = `status: published`. Share holders can still vote / read /
 * record expenses, but day-item edits 404. Owner edits remain.
 *
 * Installed by prompt [V.UX.8].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';
import { uniqueEmail } from './factories';

const TEST_PREFIX = 'trip-lock-e2e';
// Lone Pacific anchor — collision-free with other Trip suites.
const REMOTE = { lat: -22.4321, lng: -146.5432 };

interface TripBody {
  readonly id: string;
  readonly status: string;
}

describe('Trip lock/unlock (integration, requires Docker Postgres + Redis)', () => {
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
      console.warn(`trip-lock test: infra not reachable (${message}). Skipping.`);
      dbReachable = false;
    }
  });

  afterEach(async () => {
    if (dbReachable) {
      await prisma.user.deleteMany({
        where: { displayName: { startsWith: TEST_PREFIX } },
      });
    }
  });

  afterAll(async () => {
    if (dbReachable) {
      await app.close();
    }
    await moduleRef.close();
  });

  async function registerUser(suffix: string): Promise<{ accessToken: string; userId: string }> {
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
    return JSON.parse(res.body) as { accessToken: string; userId: string };
  }

  async function createTrip(token: string): Promise<TripBody> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/trips',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        title: 'Lock test',
        center: REMOTE,
        radiusKm: 10,
        startsOn: '2026-08-01T00:00:00.000Z',
        endsOn: '2026-08-01T00:00:00.000Z',
      },
    });
    expect(res.statusCode).toBe(201);
    return JSON.parse(res.body) as TripBody;
  }

  it('owner locks → status=published; unlocks → status=draft', async () => {
    if (!dbReachable) return;
    const owner = await registerUser('owner');
    const trip = await createTrip(owner.accessToken);
    expect(trip.status).toBe('draft');

    const lock = await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${trip.id}/lock`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
    });
    expect(lock.statusCode).toBe(200);
    expect((JSON.parse(lock.body) as TripBody).status).toBe('published');

    const unlock = await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${trip.id}/unlock`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
    });
    expect(unlock.statusCode).toBe(200);
    expect((JSON.parse(unlock.body) as TripBody).status).toBe('draft');
  });

  it('non-owner → 404 TRIP_NOT_FOUND on lock', async () => {
    if (!dbReachable) return;
    const owner = await registerUser('alice');
    const stranger = await registerUser('bob');
    const trip = await createTrip(owner.accessToken);

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${trip.id}/lock`,
      headers: { authorization: `Bearer ${stranger.accessToken}` },
    });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).code).toBe('TRIP_NOT_FOUND');
  });

  it('locked trip — share-collaborator day-item edit → 404', async () => {
    if (!dbReachable) return;
    const owner = await registerUser('owner2');
    const collab = await registerUser('collab');
    const trip = await createTrip(owner.accessToken);

    // Generate the itinerary so there's a day to edit.
    const gen = await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${trip.id}/itinerary`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
    });
    expect(gen.statusCode).toBe(200);
    const days = (JSON.parse(gen.body) as { days: Array<{ id: string }> }).days;
    const dayId = days[0]!.id;

    // Mint a share so collab gets edit access (pre-lock).
    const share = await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${trip.id}/share`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: {},
    });
    expect(share.statusCode).toBe(201);

    // Pre-lock: collab can edit.
    const preLock = await app.inject({
      method: 'PATCH',
      url: `/api/v1/trips/${trip.id}/itinerary/${dayId}`,
      headers: { authorization: `Bearer ${collab.accessToken}` },
      payload: { items: [] },
    });
    expect(preLock.statusCode).toBe(200);

    // Owner locks.
    const lock = await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${trip.id}/lock`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
    });
    expect(lock.statusCode).toBe(200);

    // Post-lock: collab is denied.
    const postLock = await app.inject({
      method: 'PATCH',
      url: `/api/v1/trips/${trip.id}/itinerary/${dayId}`,
      headers: { authorization: `Bearer ${collab.accessToken}` },
      payload: { items: [] },
    });
    expect(postLock.statusCode).toBe(404);
    expect(JSON.parse(postLock.body).code).toBe('TRIP_NOT_FOUND');

    // Owner can still edit on a locked trip.
    const ownerEdit = await app.inject({
      method: 'PATCH',
      url: `/api/v1/trips/${trip.id}/itinerary/${dayId}`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: { items: [] },
    });
    expect(ownerEdit.statusCode).toBe(200);
  });

  it('lock is idempotent — relocking returns 200 status=published', async () => {
    if (!dbReachable) return;
    const owner = await registerUser('idem');
    const trip = await createTrip(owner.accessToken);

    for (let i = 0; i < 2; i++) {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/trips/${trip.id}/lock`,
        headers: { authorization: `Bearer ${owner.accessToken}` },
      });
      expect(res.statusCode).toBe(200);
      expect((JSON.parse(res.body) as TripBody).status).toBe('published');
    }
  });
});
