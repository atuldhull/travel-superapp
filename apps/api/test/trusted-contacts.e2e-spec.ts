/**
 * V.UX.13 — trusted-contacts CRUD + SOS fan-out integration tests.
 *
 *   GET    /api/v1/account/trusted-contacts        — list mine
 *   POST   /api/v1/account/trusted-contacts        — add (cap 3)
 *   DELETE /api/v1/account/trusted-contacts/:id    — owner-scoped
 *   POST   /api/v1/safety/sos                      — triggers + fans out
 *
 * Asserts the cap, channel-required guard, IDOR posture, and that
 * the StubContactNotifier ring captures one entry per pre-set
 * contact when an SOS is triggered.
 *
 * Installed by prompt [V.UX.13].
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';
import { StubContactNotifierAdapter } from '../src/modules/safety/infrastructure/stub-contact-notifier.adapter';
import { uniqueEmail } from './factories';

const TEST_PREFIX = 'trusted-contacts-e2e';

interface ContactResp {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly phone: string | null;
  readonly email: string | null;
}

describe('Trusted contacts + SOS fan-out (V.UX.13 — integration)', () => {
  let moduleRef: TestingModule;
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let notifier: StubContactNotifierAdapter;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.useGlobalFilters(new AllExceptionFilter(), new DomainExceptionFilter());
    app.setGlobalPrefix('api/v1', { exclude: ['health', 'health/(.*)'] });
    await app.register(fastifyCookie);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    prisma = moduleRef.get(PrismaService);
    notifier = moduleRef.get(StubContactNotifierAdapter);
    await prisma.$queryRaw`SELECT 1`;
  });

  afterEach(async () => {
    notifier.clear();
    await prisma.user.deleteMany({
      where: { displayName: { startsWith: TEST_PREFIX } },
    });
  });

  afterAll(async () => {
    await app.close();
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

  async function addContact(token: string, body: object) {
    return app.inject({
      method: 'POST',
      url: '/api/v1/account/trusted-contacts',
      headers: { authorization: `Bearer ${token}` },
      payload: body,
    });
  }

  it('GET without bearer → 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/account/trusted-contacts',
    });
    expect(res.statusCode).toBe(401);
  });

  it('happy path: add → list → delete', async () => {
    const { accessToken } = await registerUser('happy');

    const add = await addContact(accessToken, {
      name: 'Mom',
      phone: '+15551234567',
    });
    expect(add.statusCode).toBe(201);
    const created = JSON.parse(add.body) as ContactResp;
    expect(created.name).toBe('Mom');
    expect(created.phone).toBe('+15551234567');
    expect(created.email).toBeNull();

    const list = await app.inject({
      method: 'GET',
      url: '/api/v1/account/trusted-contacts',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(list.statusCode).toBe(200);
    const body = JSON.parse(list.body) as { contacts: ContactResp[] };
    expect(body.contacts).toHaveLength(1);
    expect(body.contacts[0]!.id).toBe(created.id);

    const del = await app.inject({
      method: 'DELETE',
      url: `/api/v1/account/trusted-contacts/${created.id}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(del.statusCode).toBe(204);

    const after = await app.inject({
      method: 'GET',
      url: '/api/v1/account/trusted-contacts',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect((JSON.parse(after.body) as { contacts: ContactResp[] }).contacts).toEqual([]);
  });

  it('POST without phone or email → 422 CONTACT_CHANNEL_REQUIRED', async () => {
    const { accessToken } = await registerUser('chan');
    const res = await addContact(accessToken, { name: 'Nameless' });
    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body).code).toBe('CONTACT_CHANNEL_REQUIRED');
  });

  it('cap of 3 enforced — 4th add → 422 CONTACT_LIMIT_REACHED', async () => {
    const { accessToken } = await registerUser('cap');
    for (let i = 0; i < 3; i++) {
      const res = await addContact(accessToken, {
        name: `Contact ${i}`,
        phone: `+155500000${i}0`,
      });
      expect(res.statusCode).toBe(201);
    }
    const fourth = await addContact(accessToken, {
      name: 'Too Many',
      email: 'too-many@example.com',
    });
    expect(fourth.statusCode).toBe(422);
    expect(JSON.parse(fourth.body).code).toBe('CONTACT_LIMIT_REACHED');
  });

  it("DELETE on someone else's contact → 404 CONTACT_NOT_FOUND", async () => {
    const alice = await registerUser('a');
    const bob = await registerUser('b');
    const aliceAdd = await addContact(alice.accessToken, {
      name: 'Alice contact',
      phone: '+15551111111',
    });
    const aliceContactId = (JSON.parse(aliceAdd.body) as ContactResp).id;

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/account/trusted-contacts/${aliceContactId}`,
      headers: { authorization: `Bearer ${bob.accessToken}` },
    });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).code).toBe('CONTACT_NOT_FOUND');
  });

  it('SOS trigger fans out to every pre-set contact', async () => {
    const { userId, accessToken } = await registerUser('sos');
    await addContact(accessToken, { name: 'Mom', phone: '+15550000001' });
    await addContact(accessToken, { name: 'Friend', email: 'friend@example.com' });
    notifier.clear();

    const sos = await app.inject({
      method: 'POST',
      url: '/api/v1/safety/sos',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { center: { lat: 12.97, lng: 77.59 }, trigger: 'user_tap' },
    });
    expect(sos.statusCode).toBe(201);
    const sosBody = JSON.parse(sos.body) as { id: string };

    const drained = notifier.drain();
    const forThisSos = drained.filter((n) => n.sosEventId === sosBody.id);
    expect(forThisSos).toHaveLength(2);
    const names = forThisSos.map((n) => n.contactName).sort();
    expect(names).toEqual(['Friend', 'Mom']);
    for (const n of forThisSos) {
      expect(n.travelerUserId).toBe(userId);
      expect(n.lat).toBe(12.97);
      expect(n.lng).toBe(77.59);
      expect(n.trigger).toBe('user_tap');
    }
  });

  it('SOS trigger with zero contacts → 201, ring untouched', async () => {
    const { accessToken } = await registerUser('sos-empty');
    notifier.clear();
    const sos = await app.inject({
      method: 'POST',
      url: '/api/v1/safety/sos',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { center: { lat: 0, lng: 0 }, trigger: 'user_tap' },
    });
    expect(sos.statusCode).toBe(201);
    const sosBody = JSON.parse(sos.body) as { id: string };
    const drained = notifier.drain();
    expect(drained.filter((n) => n.sosEventId === sosBody.id)).toHaveLength(0);
  });
});
