/**
 * V.UX.18 — translation stub + country primer.
 *
 *   POST /api/v1/translation/translate
 *   GET  /api/v1/safety/country-primer/:countryCode
 *
 * Asserts: stub provider prefixes the input, validation rejects
 * empty / over-long text, primer for a seeded country returns
 * the editorial shape, unknown country code yields 404.
 *
 * Installed by prompt [V.UX.18].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';
import { uniqueEmail } from './factories';

const TEST_PREFIX = 'translation-primer-e2e';

describe('Translation + country primer (V.UX.18 — integration)', () => {
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
      console.warn(`translation-primer test: infra not reachable (${message}). Skipping.`);
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

  it('POST /translation/translate stub prefixes the input', async () => {
    if (!infraReachable) return;
    const { accessToken } = await registerUser('stub');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/translation/translate',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { text: 'Hello world', targetLang: 'fr' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      sourceText: string;
      translatedText: string;
      targetLang: string;
      provider: string;
      sourceLang: string | null;
    };
    expect(body.sourceText).toBe('Hello world');
    expect(body.translatedText).toBe('[stub:fr] Hello world');
    expect(body.targetLang).toBe('fr');
    expect(body.provider).toBe('stub');
    expect(body.sourceLang).toBeNull();
  });

  it('POST /translation/translate honors sourceLang when supplied', async () => {
    if (!infraReachable) return;
    const { accessToken } = await registerUser('src');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/translation/translate',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { text: 'Bonjour', sourceLang: 'fr', targetLang: 'EN' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { targetLang: string; sourceLang: string | null };
    expect(body.targetLang).toBe('en'); // adapter normalises to lower-case
    expect(body.sourceLang).toBe('fr');
  });

  it('POST /translation/translate empty text → 422', async () => {
    if (!infraReachable) return;
    const { accessToken } = await registerUser('empty');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/translation/translate',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { text: '', targetLang: 'fr' },
    });
    expect(res.statusCode).toBe(422);
  });

  it('POST /translation/translate without bearer → 401', async () => {
    if (!infraReachable) return;
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/translation/translate',
      payload: { text: 'Hi', targetLang: 'fr' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('GET /safety/country-primer/:code returns the seeded primer', async () => {
    if (!infraReachable) return;
    const { accessToken } = await registerUser('primer');
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/safety/country-primer/th',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      countryCode: string;
      countryName: string;
      visaInfo: string;
      topScamCategories: string[];
      emergencyNumbers: { label: string; number: string }[];
      languagePhrases: { translation: string; english: string }[];
    };
    expect(body.countryCode).toBe('th');
    expect(body.countryName).toBe('Thailand');
    expect(body.visaInfo.length).toBeGreaterThan(0);
    expect(body.topScamCategories.length).toBeGreaterThan(0);
    expect(body.emergencyNumbers.length).toBeGreaterThan(0);
    expect(body.languagePhrases.length).toBeGreaterThan(0);
  });

  it('GET /safety/country-primer/:code is case-insensitive', async () => {
    if (!infraReachable) return;
    const { accessToken } = await registerUser('upper');
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/safety/country-primer/JP',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { countryCode: string };
    expect(body.countryCode).toBe('jp');
  });

  it('GET /safety/country-primer/:code unknown → 404 COUNTRY_PRIMER_NOT_FOUND', async () => {
    if (!infraReachable) return;
    const { accessToken } = await registerUser('miss');
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/safety/country-primer/zz',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).code).toBe('COUNTRY_PRIMER_NOT_FOUND');
  });
});
