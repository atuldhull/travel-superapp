/**
 * Demo-deploy seed script. Populates a fresh database with sample
 * data so a smoke-tester / demo-viewer / dev-onboarder sees a
 * meaningful UX on first load instead of an empty inbox.
 *
 * Approach: boot AppModule + FastifyAdapter in-process and call
 * the real HTTP surface via `app.inject`. Every seeded row goes
 * through the same auth + ownership + validation gates as
 * production traffic — no Prisma-shortcut writes that would
 * sidestep PostGIS / domain rules / CLAUDE rule 11.
 *
 * Usage:
 *   pnpm --filter=api db:seed:demo
 *
 * Requirements:
 *   - `DATABASE_URL` pointing at the target DB (NOT prod — the
 *     script doesn't dedupe; running twice doubles the demo rows).
 *   - All other env vars satisfied (the AppModule's env-validation
 *     fails fast otherwise).
 *
 * Idempotency caveat: this script is NOT idempotent. It registers
 * timestamp-suffixed users, creates new trips, etc. Re-running
 * doubles the data. For a clean demo, drop the DB first or run
 * against a freshly-migrated instance.
 *
 * What it loads:
 *   - 2 demo users (alice, bob) with TOTP MFA disabled
 *   - 3 trips per user (different cities + date ranges)
 *   - Itinerary stubs on each trip
 *   - 2 published memory books (one per user)
 *   - Sample reviews against demo opaque ids (place, agent, eatery)
 *
 * Installed by prompt [IV.18.19.4].
 */
import 'reflect-metadata';
import fastifyCookie from '@fastify/cookie';
import { Test } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';

interface DemoCity {
  readonly slug: string;
  readonly title: string;
  readonly center: { lat: number; lng: number };
  readonly startsOn: string;
  readonly endsOn: string;
}

const DEMO_CITIES: readonly DemoCity[] = [
  {
    slug: 'tokyo',
    title: 'Tokyo neighbourhoods',
    center: { lat: 35.6762, lng: 139.6503 },
    startsOn: '2026-09-12',
    endsOn: '2026-09-18',
  },
  {
    slug: 'lisbon',
    title: 'Lisbon weekend',
    center: { lat: 38.7223, lng: -9.1393 },
    startsOn: '2026-10-03',
    endsOn: '2026-10-06',
  },
  {
    slug: 'mexico-city',
    title: 'CDMX coffee crawl',
    center: { lat: 19.4326, lng: -99.1332 },
    startsOn: '2026-11-15',
    endsOn: '2026-11-22',
  },
];

interface DemoUser {
  readonly suffix: string;
  readonly displayName: string;
}

const DEMO_USERS: readonly DemoUser[] = [
  { suffix: 'alice', displayName: 'Alice Demo' },
  { suffix: 'bob', displayName: 'Bob Demo' },
];

interface RegisterResp {
  userId: string;
  accessToken: string;
}

async function bootApp(): Promise<NestFastifyApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
  app.useGlobalFilters(new AllExceptionFilter(), new DomainExceptionFilter());
  app.setGlobalPrefix('api/v1', { exclude: ['health', 'health/(.*)', 'metrics'] });
  await app.register(fastifyCookie);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}

async function registerUser(
  app: NestFastifyApplication,
  user: DemoUser,
  runId: string,
): Promise<RegisterResp> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: {
      email: `demo-${user.suffix}-${runId}@example.com`,
      password: 'demo-password-min-12-chars-123',
      displayName: `${user.displayName} (${runId})`,
    },
  });
  if (res.statusCode !== 201) {
    throw new Error(`register ${user.suffix} failed: ${res.statusCode} ${res.body}`);
  }
  return JSON.parse(res.body) as RegisterResp;
}

async function createTrip(
  app: NestFastifyApplication,
  token: string,
  city: DemoCity,
): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/trips',
    headers: { authorization: `Bearer ${token}` },
    payload: {
      title: city.title,
      center: city.center,
      radiusKm: 10,
      startsOn: city.startsOn,
      endsOn: city.endsOn,
    },
  });
  if (res.statusCode !== 201) {
    throw new Error(`create trip ${city.slug} failed: ${res.statusCode} ${res.body}`);
  }
  return (JSON.parse(res.body) as { id: string }).id;
}

async function generateItinerary(
  app: NestFastifyApplication,
  token: string,
  tripId: string,
): Promise<void> {
  // Itinerary generation surface — the stub use-case lays one
  // ItineraryDay per date in the trip's range.
  const res = await app.inject({
    method: 'POST',
    url: `/api/v1/trips/${tripId}/itinerary`,
    headers: { authorization: `Bearer ${token}` },
  });
  if (res.statusCode !== 200 && res.statusCode !== 201) {
    // Non-fatal — the stub may already have run, or the trip lacks
    // dates. Log + continue.
    // eslint-disable-next-line no-console
    console.warn(`  itinerary stub for ${tripId} returned ${res.statusCode}`);
  }
}

async function createPublishedBook(
  app: NestFastifyApplication,
  token: string,
  title: string,
  theme: string,
): Promise<string> {
  const create = await app.inject({
    method: 'POST',
    url: '/api/v1/memory-books',
    headers: { authorization: `Bearer ${token}` },
    payload: { title, theme },
  });
  if (create.statusCode !== 201) {
    throw new Error(`create book "${title}" failed: ${create.statusCode} ${create.body}`);
  }
  const id = (JSON.parse(create.body) as { id: string }).id;
  const publish = await app.inject({
    method: 'POST',
    url: `/api/v1/memory-books/${id}/publish`,
    headers: { authorization: `Bearer ${token}` },
  });
  if (publish.statusCode !== 200) {
    throw new Error(`publish book "${title}" failed: ${publish.statusCode} ${publish.body}`);
  }
  return id;
}

async function postReview(
  app: NestFastifyApplication,
  token: string,
  targetType: 'place' | 'stay' | 'eatery' | 'agent',
  targetId: string,
  rating: number,
  body: string,
): Promise<void> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/reviews',
    headers: { authorization: `Bearer ${token}` },
    payload: { targetType, targetId, rating, body },
  });
  if (res.statusCode !== 201) {
    // eslint-disable-next-line no-console
    console.warn(`  review ${targetType}/${targetId} returned ${res.statusCode}`);
  }
}

async function main(): Promise<void> {
  // eslint-disable-next-line no-console
  const log = (...args: unknown[]): void => console.log('[seed-demo]', ...args);

  // Run-id keeps emails unique across re-runs even though rows
  // aren't deduped. Easier than parsing failures.
  const runId = Math.floor(Date.now() / 1000).toString(36);

  log('booting app...');
  const app = await bootApp();
  let createdUsers = 0;
  let createdTrips = 0;
  let createdBooks = 0;
  let postedReviews = 0;
  try {
    // Stable demo opaque ids so cross-target review summaries
    // accumulate signal across runs.
    const demoPlaceId = 'demo-place-shibuya-xing';
    const demoAgentId = 'demo-agent-kenji';
    const demoEateryId = 'demo-eatery-konjiki-hototogisu';

    for (const user of DEMO_USERS) {
      log(`registering ${user.suffix}...`);
      const reg = await registerUser(app, user, runId);
      createdUsers++;

      for (const city of DEMO_CITIES) {
        log(`  creating trip ${city.slug} for ${user.suffix}...`);
        const tripId = await createTrip(app, reg.accessToken, city);
        createdTrips++;
        await generateItinerary(app, reg.accessToken, tripId);
      }

      log(`  creating + publishing book for ${user.suffix}...`);
      await createPublishedBook(
        app,
        reg.accessToken,
        `${user.displayName}'s travel album`,
        'classic',
      );
      createdBooks++;

      log(`  posting demo reviews from ${user.suffix}...`);
      await postReview(app, reg.accessToken, 'place', demoPlaceId, 5, 'Iconic spot.');
      await postReview(app, reg.accessToken, 'agent', demoAgentId, 4, 'Smooth handoff.');
      await postReview(app, reg.accessToken, 'eatery', demoEateryId, 5, 'Best ramen of the trip.');
      postedReviews += 3;
    }

    log('done.');
    log(
      `summary: users=${createdUsers}, trips=${createdTrips}, books=${createdBooks}, reviews=${postedReviews}`,
    );
  } finally {
    await app.close();
  }
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  // eslint-disable-next-line no-console
  console.error('[seed-demo] FAILED:', message);
  process.exit(1);
});
