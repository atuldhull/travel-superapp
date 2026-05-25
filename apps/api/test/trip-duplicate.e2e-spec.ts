/**
 * Integration tests for `POST /trips/:id/duplicate` ([V.UX.5]).
 * Deep-copies title (+" (copy)"), radius, dates, and itinerary
 * days/items. Owner-only.
 *
 * Installed by prompt [V.UX.5].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';
import { uniqueEmail } from './factories';

const TEST_PREFIX = 'trip-duplicate-e2e';
// South-Atlantic remote coord; no collision with other Trip suites.
const REMOTE = { lat: -38.4321, lng: -32.5678 };

interface TripBody {
  readonly id: string;
  readonly title: string;
  readonly status: string;
  readonly radiusKm: number;
  readonly startsOn: string | null;
  readonly endsOn: string | null;
}

describe('Trip duplicate (integration, requires Docker Postgres + Redis)', () => {
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

  async function registerUser(suffix: string): Promise<{ accessToken: string }> {
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
    return JSON.parse(res.body) as { accessToken: string };
  }

  async function createTrip(
    accessToken: string,
    overrides?: Partial<{ title: string; radiusKm: number; startsOn: string; endsOn: string }>,
  ): Promise<TripBody> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/trips',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        title: overrides?.title ?? 'Original trip',
        center: REMOTE,
        radiusKm: overrides?.radiusKm ?? 25,
        ...(overrides?.startsOn ? { startsOn: overrides.startsOn } : {}),
        ...(overrides?.endsOn ? { endsOn: overrides.endsOn } : {}),
      },
    });
    expect(res.statusCode).toBe(201);
    return JSON.parse(res.body) as TripBody;
  }

  it('duplicates title (+ " (copy)"), radius, dates as a fresh draft', async () => {
    const { accessToken } = await registerUser('basic');
    const original = await createTrip(accessToken, {
      title: 'Q3 Bangalore offsite',
      radiusKm: 40,
      startsOn: '2026-08-01T00:00:00.000Z',
      endsOn: '2026-08-04T00:00:00.000Z',
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${original.id}/duplicate`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {},
    });
    expect(res.statusCode).toBe(201);
    const dup = JSON.parse(res.body) as TripBody;

    expect(dup.id).not.toBe(original.id);
    expect(dup.title).toBe('Q3 Bangalore offsite (copy)');
    expect(dup.radiusKm).toBe(40);
    expect(dup.status).toBe('draft');
    expect(dup.startsOn).toBe(original.startsOn);
    expect(dup.endsOn).toBe(original.endsOn);
  });

  it('deep-copies itinerary days + items', async () => {
    const { accessToken } = await registerUser('itin');
    const original = await createTrip(accessToken, {
      startsOn: '2026-09-01T00:00:00.000Z',
      endsOn: '2026-09-02T00:00:00.000Z',
    });

    // Generate the itinerary stub on the source so it has 2 days.
    const gen = await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${original.id}/itinerary`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(gen.statusCode).toBe(200);

    const dupRes = await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${original.id}/duplicate`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {},
    });
    expect(dupRes.statusCode).toBe(201);
    const dup = JSON.parse(dupRes.body) as TripBody;

    const itinRes = await app.inject({
      method: 'GET',
      url: `/api/v1/trips/${dup.id}/itinerary`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(itinRes.statusCode).toBe(200);
    const itin = JSON.parse(itinRes.body) as { days: Array<{ items: unknown[] }> };
    expect(itin.days).toHaveLength(2);
  });

  it('non-owner → 404 TRIP_NOT_FOUND', async () => {
    const alice = await registerUser('alice');
    const bob = await registerUser('bob');
    const original = await createTrip(alice.accessToken);

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${original.id}/duplicate`,
      headers: { authorization: `Bearer ${bob.accessToken}` },
      payload: {},
    });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).code).toBe('TRIP_NOT_FOUND');
  });

  it('unauthenticated → 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/trips/whatever/duplicate',
      payload: {},
    });
    expect(res.statusCode).toBe(401);
  });

  it('duplicate of dateless trip works (no itinerary)', async () => {
    const { accessToken } = await registerUser('dateless');
    const original = await createTrip(accessToken);

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/trips/${original.id}/duplicate`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {},
    });
    expect(res.statusCode).toBe(201);
    const dup = JSON.parse(res.body) as TripBody;
    expect(dup.startsOn).toBeNull();
    expect(dup.endsOn).toBeNull();
  });
});
