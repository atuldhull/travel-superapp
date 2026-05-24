/**
 * V.UX.15 — comfort-mode preference + step-free transport routing.
 *
 *   POST /api/v1/transport/routes        (with stepFreeOnly)
 *   PATCH /api/v1/account/preferences    (comfortMode upsert)
 *
 * Asserts: every leg in the default response carries a `stepFree`
 * boolean; `stepFreeOnly: true` drops `walk` + `public_transit`
 * (mock-flagged not-step-free); comfortMode round-trips through
 * the preferences upsert and is echoed by the GET.
 *
 * Installed by prompt [V.UX.15].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';
import { uniqueEmail } from './factories';

const TEST_PREFIX = 'transport-step-free-e2e';

interface RouteLegResp {
  readonly mode: string;
  readonly distanceMeters: number;
  readonly stepFree: boolean;
}

describe('Step-free routing + comfortMode (V.UX.15 — integration)', () => {
  let moduleRef: TestingModule;
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let infraReachable = true;

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
      console.warn(`transport-step-free test: infra not reachable (${message}). Skipping.`);
      infraReachable = false;
    }
  });

  afterEach(async () => {
    if (!infraReachable) return;
    await prisma.user.deleteMany({
      where: { displayName: { startsWith: TEST_PREFIX } },
    });
  });

  afterAll(async () => {
    if (infraReachable) await app.close();
    await moduleRef.close();
  });

  async function registerUser(suffix: string): Promise<{ userId: string; accessToken: string }> {
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

  // Pick coords inside the 20km walk/100km transit caps so every
  // mode shows up by default — lets us assert the filter actually
  // drops things rather than the cap doing it.
  const origin = { lat: 28.6139, lng: 77.209 };
  const destination = { lat: 28.6219, lng: 77.219 }; // ~1.5 km away

  it('default response: every leg has a stepFree boolean; walk + transit are not step-free', async () => {
    if (!infraReachable) return;
    const { accessToken } = await registerUser('default');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/transport/routes',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { origin, destination },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { routes: RouteLegResp[] };
    // Every leg has the new field.
    for (const r of body.routes) expect(typeof r.stepFree).toBe('boolean');
    const walk = body.routes.find((r) => r.mode === 'walk');
    const transit = body.routes.find((r) => r.mode === 'public_transit');
    const car = body.routes.find((r) => r.mode === 'car');
    expect(walk?.stepFree).toBe(false);
    expect(transit?.stepFree).toBe(false);
    expect(car?.stepFree).toBe(true);
  });

  it('stepFreeOnly: true drops walk + public_transit', async () => {
    if (!infraReachable) return;
    const { accessToken } = await registerUser('stepfree');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/transport/routes',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { origin, destination, stepFreeOnly: true },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { routes: RouteLegResp[] };
    const modes = body.routes.map((r) => r.mode);
    expect(modes).not.toContain('walk');
    expect(modes).not.toContain('public_transit');
    // Step-free modes still surface.
    expect(modes).toContain('car');
    expect(modes).toContain('taxi');
    for (const r of body.routes) expect(r.stepFree).toBe(true);
  });

  it('PATCH /preferences { comfortMode: true } round-trips through GET', async () => {
    if (!infraReachable) return;
    const { accessToken } = await registerUser('comfort');
    const before = await app.inject({
      method: 'GET',
      url: '/api/v1/account/preferences',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(JSON.parse(before.body).comfortMode).toBe(false);

    const patch = await app.inject({
      method: 'PATCH',
      url: '/api/v1/account/preferences',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { comfortMode: true },
    });
    expect(patch.statusCode).toBe(200);
    expect(JSON.parse(patch.body).comfortMode).toBe(true);

    const after = await app.inject({
      method: 'GET',
      url: '/api/v1/account/preferences',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(JSON.parse(after.body).comfortMode).toBe(true);
  });
});
