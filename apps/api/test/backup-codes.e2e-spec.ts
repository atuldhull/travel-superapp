/**
 * Integration tests for MFA backup codes ([III.13.2] part 5):
 *   - Setup → verify returns 10 plaintext backup codes.
 *   - Login with a backup code succeeds + marks it consumed.
 *   - Same backup code replayed → rejected.
 *   - Login with a TOTP code still works (backup codes don't
 *     disable the primary factor).
 *   - /mfa/backup-codes/regenerate rotates codes after a TOTP
 *     proof; old codes no longer work.
 *   - Disable MFA also clears every backup code.
 *
 * Installed by prompt [III.13.2] part 5.
 */
import fastifyCookie from '@fastify/cookie';
import { Test, type TestingModule } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import speakeasy from 'speakeasy';
import { AppModule } from '../src/app.module';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { PrismaService } from '../src/common/db/prisma.service';
import { uniqueEmail } from './factories';

const TEST_PREFIX = 'backup-e2e';

function totp(secret: string): string {
  return speakeasy.totp({ secret, encoding: 'base32' });
}

describe('MFA backup codes (integration, requires Docker Postgres)', () => {
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
      console.warn(`backup-codes test: DB not reachable (${message}). Skipping.`);
      dbReachable = false;
    }
  });

  afterEach(async () => {
    if (!dbReachable) return;
    await prisma.user.deleteMany({
      where: { displayName: { startsWith: TEST_PREFIX } },
    });
  });

  afterAll(async () => {
    if (dbReachable) {
      await app.close();
    }
    await moduleRef.close();
  });

  /**
   * Helper — register a user, enrol MFA, return email/password, the
   * shared TOTP secret (so the test can mint codes), and the 10
   * plaintext backup codes issued at enrolment.
   */
  async function enrollUser(suffix: string): Promise<{
    email: string;
    password: string;
    userId: string;
    accessToken: string;
    totpSecret: string;
    backupCodes: readonly string[];
  }> {
    const email = uniqueEmail(`${TEST_PREFIX}-${suffix}`);
    const password = 'correct-horse-battery-staple';
    const reg = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email, password, displayName: `${TEST_PREFIX}-${suffix}` },
      headers: { 'user-agent': 'backup-ua' },
    });
    expect(reg.statusCode).toBe(201);
    const { userId, accessToken } = JSON.parse(reg.body) as {
      userId: string;
      accessToken: string;
    };

    const setup = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/mfa/setup',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(setup.statusCode).toBe(200);
    const { base32 } = JSON.parse(setup.body) as { base32: string };

    const verify = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/mfa/verify',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { code: totp(base32) },
    });
    expect(verify.statusCode).toBe(200);
    const { backupCodes } = JSON.parse(verify.body) as { backupCodes: string[] };
    return { email, password, userId, accessToken, totpSecret: base32, backupCodes };
  }

  it('enrolment returns 10 unique 8-char alphanumeric backup codes', async () => {
    if (!dbReachable) return;
    const { userId, backupCodes } = await enrollUser('enrol');

    expect(backupCodes).toHaveLength(10);
    for (const code of backupCodes) {
      expect(code).toMatch(/^[A-Z2-9]{8}$/);
    }
    // All unique.
    expect(new Set(backupCodes).size).toBe(10);

    // 10 hashed rows persisted, all unused.
    const rows = await prisma.mfaBackupCode.count({ where: { userId } });
    expect(rows).toBe(10);
    const unused = await prisma.mfaBackupCode.count({
      where: { userId, usedAt: null },
    });
    expect(unused).toBe(10);
  });

  it('login with a backup code succeeds and marks that code consumed', async () => {
    if (!dbReachable) return;
    const { email, password, userId, backupCodes } = await enrollUser('consume');
    const code = backupCodes[0]!;

    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password, mfaCode: code },
      headers: { 'user-agent': 'backup-ua' },
    });
    expect(loginRes.statusCode).toBe(200);

    const unused = await prisma.mfaBackupCode.count({
      where: { userId, usedAt: null },
    });
    expect(unused).toBe(9);
  });

  it('replaying a consumed backup code returns 401 INVALID_MFA', async () => {
    if (!dbReachable) return;
    const { email, password, backupCodes } = await enrollUser('replay');
    const code = backupCodes[0]!;

    const first = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password, mfaCode: code },
      headers: { 'user-agent': 'backup-ua' },
    });
    expect(first.statusCode).toBe(200);

    const second = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password, mfaCode: code },
      headers: { 'user-agent': 'backup-ua' },
    });
    expect(second.statusCode).toBe(401);
    expect(JSON.parse(second.body).code).toBe('INVALID_MFA');
  });

  it('TOTP code still works after backup codes are issued (parallel factors)', async () => {
    if (!dbReachable) return;
    const { email, password, totpSecret, userId } = await enrollUser('parallel');
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password, mfaCode: totp(totpSecret) },
      headers: { 'user-agent': 'backup-ua' },
    });
    expect(loginRes.statusCode).toBe(200);
    // No backup code was used.
    const unused = await prisma.mfaBackupCode.count({
      where: { userId, usedAt: null },
    });
    expect(unused).toBe(10);
  });

  it('regenerate rotates codes — old ones no longer work, new ones do', async () => {
    if (!dbReachable) return;
    const {
      email,
      password,
      accessToken,
      totpSecret,
      backupCodes: oldCodes,
    } = await enrollUser('rotate');

    const regen = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/mfa/backup-codes/regenerate',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { code: totp(totpSecret) },
    });
    expect(regen.statusCode).toBe(200);
    const newCodes = (JSON.parse(regen.body) as { backupCodes: string[] }).backupCodes;
    expect(newCodes).toHaveLength(10);
    expect(new Set(newCodes).size).toBe(10);
    // New codes are a different set from the old ones.
    const overlap = oldCodes.filter((c) => newCodes.includes(c));
    expect(overlap).toHaveLength(0);

    // Old code no longer redeems.
    const oldAttempt = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password, mfaCode: oldCodes[0] },
      headers: { 'user-agent': 'backup-ua' },
    });
    expect(oldAttempt.statusCode).toBe(401);
    expect(JSON.parse(oldAttempt.body).code).toBe('INVALID_MFA');

    // New code works.
    const newAttempt = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password, mfaCode: newCodes[0] },
      headers: { 'user-agent': 'backup-ua' },
    });
    expect(newAttempt.statusCode).toBe(200);
  });

  it('regenerate with a wrong TOTP → 401 INVALID_MFA', async () => {
    if (!dbReachable) return;
    const { accessToken } = await enrollUser('regen-deny');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/mfa/backup-codes/regenerate',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { code: '000000' },
    });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).code).toBe('INVALID_MFA');
  });

  it('disabling MFA clears every backup code', async () => {
    if (!dbReachable) return;
    const { userId, accessToken, totpSecret } = await enrollUser('disable');

    const disable = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/mfa/disable',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { code: totp(totpSecret) },
    });
    expect(disable.statusCode).toBe(204);

    const rows = await prisma.mfaBackupCode.count({ where: { userId } });
    expect(rows).toBe(0);
  });
});
