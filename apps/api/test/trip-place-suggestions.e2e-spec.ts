/**
 * Integration tests for `POST /trips/:id/place-suggestions`
 * ([V.UX.4]). Owner-gated, calls the federated PLACE_PROVIDER, write-
 * throughs into the canonical Place catalog, returns up to 6 ranked
 * suggestions with persisted `placeId`s.
 *
 * Mirrors the trip-eateries suite shape: registers a user, creates
 * a trip, calls the route, asserts on shape + ownership defence.
 *
 * Installed by prompt [V.UX.4].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';
import { uniqueEmail } from './factories';

const TEST_PREFIX = 'trip-suggestions-e2e';
// Western-Sahara desert coord — no collision with other Trip suites.
const REMOTE = { lat: 21.5432, lng: -14.7654 };

interface SuggestionDto {
  readonly placeId: string;
  readonly name: string;
  readonly category: string;
  readonly distanceMeters: number;
}

describe('Trip × Place Suggestions (integration, requires Docker Postgres + Redis)', () => {
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
      console.warn(`trip-place-suggestions test: infra not reachable (${message}). Skipping.`);
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
        title: 'Suggestion test trip',
        center: REMOTE,
        radiusKm: 25,
      },
    });
    expect(res.statusCode).toBe(201);
    return { id: (JSON.parse(res.body) as { id: string }).id };
  }

  it('returns ranked suggestions with persisted placeIds', async () => {
    if (!dbReachable) return;
    const { accessToken } = await registerUser('ok');
    const trip = await createTrip(accessToken);

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${trip.id}/place-suggestions`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { suggestions: SuggestionDto[] };
    expect(body.suggestions.length).toBeGreaterThan(0);
    expect(body.suggestions.length).toBeLessThanOrEqual(6);
    for (const s of body.suggestions) {
      expect(typeof s.placeId).toBe('string');
      expect(s.placeId.length).toBeGreaterThan(0);
      expect(typeof s.name).toBe('string');
      expect(typeof s.category).toBe('string');
      expect(typeof s.distanceMeters).toBe('number');
    }
    // Sorted ascending by distanceMeters.
    for (let i = 1; i < body.suggestions.length; i++) {
      expect(body.suggestions[i]!.distanceMeters).toBeGreaterThanOrEqual(
        body.suggestions[i - 1]!.distanceMeters,
      );
    }
    // Persisted Place rows exist for every returned id.
    for (const s of body.suggestions) {
      const row = await prisma.place.findUnique({ where: { id: s.placeId } });
      expect(row).not.toBeNull();
    }
  });

  it('category filter narrows results to a single category', async () => {
    if (!dbReachable) return;
    const { accessToken } = await registerUser('cat');
    const trip = await createTrip(accessToken);

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${trip.id}/place-suggestions`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { category: 'museum' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { suggestions: SuggestionDto[] };
    for (const s of body.suggestions) {
      expect(s.category).toBe('museum');
    }
  });

  it('non-owner → 404 TRIP_NOT_FOUND', async () => {
    if (!dbReachable) return;
    const alice = await registerUser('alice');
    const bob = await registerUser('bob');
    const trip = await createTrip(alice.accessToken);

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${trip.id}/place-suggestions`,
      headers: { authorization: `Bearer ${bob.accessToken}` },
      payload: {},
    });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).code).toBe('TRIP_NOT_FOUND');
  });

  it('unauthenticated → 401 UNAUTHENTICATED', async () => {
    if (!dbReachable) return;
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/trips/whatever/place-suggestions',
      payload: {},
    });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).code).toBe('UNAUTHENTICATED');
  });

  it('repeated calls re-use the same Place rows (idempotent ingest)', async () => {
    if (!dbReachable) return;
    const { accessToken } = await registerUser('idem');
    const trip = await createTrip(accessToken);

    const first = await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${trip.id}/place-suggestions`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {},
    });
    const second = await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${trip.id}/place-suggestions`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {},
    });
    const a = JSON.parse(first.body) as { suggestions: SuggestionDto[] };
    const b = JSON.parse(second.body) as { suggestions: SuggestionDto[] };
    expect(a.suggestions.map((s) => s.placeId).sort()).toEqual(
      b.suggestions.map((s) => s.placeId).sort(),
    );
  });
});
