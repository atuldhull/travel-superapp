/**
 * Header matrix for [IV.18.1.17].
 *
 * Drives `registerSecurity(app, env)` against a real Fastify + Nest app
 * and asserts that every Playbook §13 perimeter header is present, that
 * the CSP header carries a per-request nonce, and that the CORS origin
 * allow-list gates cross-origin responses.
 *
 * Installed by prompt [IV.18.1.17].
 */
import { Test } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { validateEnv, type Env } from '@app/config';
import { AppModule } from '../../src/app.module';
import { parseCorsOrigins, registerSecurity } from '../../src/common/security/security.register';
import { applyOfflineStubs } from '../helpers/offline-stubs';

function envWith(overrides: Partial<Record<keyof Env, string>>): Env {
  // `validateEnv` reads from a map, so clone current process.env and patch.
  const raw: Record<string, string | undefined> = { ...process.env };
  for (const [k, v] of Object.entries(overrides)) raw[k] = v;
  return validateEnv(raw);
}

async function bootApp(env: Env): Promise<NestFastifyApplication> {
  // Stub Postgres + Redis-backed throttler so this suite asserts
  // HTTP headers without a live Docker stack.
  const moduleRef = await applyOfflineStubs(
    Test.createTestingModule({ imports: [AppModule] }),
  ).compile();
  const app = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter({ logger: false }),
    { logger: false, bufferLogs: false },
  );
  app.setGlobalPrefix('api/v1', { exclude: ['health', 'health/(.*)'] });
  await registerSecurity(app, env);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}

describe('parseCorsOrigins()', () => {
  it('returns [] for empty string', () => {
    expect(parseCorsOrigins('')).toEqual([]);
  });

  it('splits and trims comma-separated entries, dropping empties', () => {
    expect(parseCorsOrigins('http://a.example, http://b.example , , http://c.example')).toEqual([
      'http://a.example',
      'http://b.example',
      'http://c.example',
    ]);
  });
});

describe('security headers in production mode', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await bootApp(envWith({ NODE_ENV: 'production', CORS_ORIGINS: 'https://travel.app' }));
  });

  afterAll(async () => {
    await app.close();
  });

  it('sets every baseline security header', async () => {
    const res = await app.inject({ method: 'GET', url: '/health/live' });
    expect(res.statusCode).toBe(200);
    const h = res.headers;

    expect(h['x-content-type-options']).toBe('nosniff');
    expect(h['x-frame-options']).toBe('DENY');
    expect(h['referrer-policy']).toBe('no-referrer');
    expect(h['cross-origin-opener-policy']).toBe('same-origin');
    expect(h['cross-origin-embedder-policy']).toBe('require-corp');
    expect(h['cross-origin-resource-policy']).toBe('same-origin');
    expect(h['x-dns-prefetch-control']).toBe('off');
    expect(h['strict-transport-security']).toBe('max-age=63072000; includeSubDomains; preload');
    expect(h['permissions-policy']).toMatch(/camera=\(\)/);
    expect(h['permissions-policy']).toMatch(/geolocation=\(\)/);
    expect(h['permissions-policy']).toMatch(/microphone=\(\)/);
  });

  it('sets a strict CSP containing trusted-types + upgrade-insecure-requests', () => {
    // Two requests back-to-back so we can also assert per-request nonces.
    return Promise.all([
      app.inject({ method: 'GET', url: '/health/live' }),
      app.inject({ method: 'GET', url: '/health/live' }),
    ]).then(([a, b]) => {
      const csp1 = a.headers['content-security-policy'] as string;
      const csp2 = b.headers['content-security-policy'] as string;
      expect(csp1).toContain(`default-src 'none'`);
      expect(csp1).toContain(`frame-ancestors 'none'`);
      expect(csp1).toContain(`base-uri 'self'`);
      expect(csp1).toContain(`form-action 'self'`);
      expect(csp1).toContain(`require-trusted-types-for 'script'`);
      expect(csp1).toContain(`trusted-types 'none'`);
      expect(csp1).toContain('upgrade-insecure-requests');

      // Per-request nonce: both responses contain a nonce, and the two
      // nonces are different.
      const nonce1 = /nonce-([A-Za-z0-9+/=_-]+)/.exec(csp1)?.[1];
      const nonce2 = /nonce-([A-Za-z0-9+/=_-]+)/.exec(csp2)?.[1];
      expect(nonce1).toBeDefined();
      expect(nonce2).toBeDefined();
      expect(nonce1).not.toEqual(nonce2);
    });
  });
});

describe('security headers in development mode', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await bootApp(envWith({ NODE_ENV: 'development', CORS_ORIGINS: '' }));
  });

  afterAll(async () => {
    await app.close();
  });

  it('has CSP but without HSTS, trusted-types or upgrade-insecure-requests', async () => {
    const res = await app.inject({ method: 'GET', url: '/health/live' });
    const h = res.headers;
    expect(h['strict-transport-security']).toBeUndefined();
    expect(h['x-content-type-options']).toBe('nosniff');

    const csp = h['content-security-policy'] as string;
    expect(csp).toContain(`default-src 'none'`);
    expect(csp).not.toContain('require-trusted-types-for');
    expect(csp).not.toContain('upgrade-insecure-requests');
  });
});

describe('CORS', () => {
  it('blocks cross-origin when CORS_ORIGINS is empty — no Access-Control-Allow-Origin on response', async () => {
    const app = await bootApp(envWith({ NODE_ENV: 'development', CORS_ORIGINS: '' }));
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/health/live',
        headers: { origin: 'https://not-allowed.example' },
      });
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    } finally {
      await app.close();
    }
  });

  it('reflects allowed origin on the preflight when listed in CORS_ORIGINS', async () => {
    const app = await bootApp(
      envWith({ NODE_ENV: 'development', CORS_ORIGINS: 'http://localhost:3000' }),
    );
    try {
      const res = await app.inject({
        method: 'OPTIONS',
        url: '/api/v1/some-route',
        headers: {
          origin: 'http://localhost:3000',
          'access-control-request-method': 'GET',
          'access-control-request-headers': 'content-type',
        },
      });
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    } finally {
      await app.close();
    }
  });

  it('omits the Allow-Origin header for a disallowed origin even when the allow-list is non-empty', async () => {
    const app = await bootApp(
      envWith({ NODE_ENV: 'development', CORS_ORIGINS: 'http://localhost:3000' }),
    );
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/health/live',
        headers: { origin: 'http://evil.example' },
      });
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    } finally {
      await app.close();
    }
  });
});
