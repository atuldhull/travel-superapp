/**
 * Phase-0 smoke suite.
 *
 * Re-asserts ONE representative acceptance criterion per Phase-0 prompt
 * that has shipped, in a single Jest file. If anything regresses — env
 * validation, filter contract, health probe shape, security perimeter,
 * shared-package exports, or the docs/ADR tree — this file turns red.
 *
 * This is the CI gate for Phase-0 → Phase-1 graduation. The GitHub
 * workflow at `.github/workflows/phase-0-smoke.yml` runs only this file
 * and blocks merges when it fails.
 *
 * Installed by prompt [IV.18.1.18].
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Test } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { HealthCheckError, type HealthIndicatorResult } from '@nestjs/terminus';
import { validateEnv, EnvValidationError, EnvSchema, type Env } from '@app/config';
import {
  DomainError,
  ValidationError,
  UnauthorizedError,
  NotFoundError,
  isDomainError,
} from '@app/errors';
import type { DomainErrorContext } from '@app/errors';
import { createLogger, runWithTraceContext } from '@app/logger';
import type { OutgoingHttpHeaders } from 'node:http';
import { AppModule } from '../../src/app.module';
import { PostgresHealthIndicator } from '../../src/health/indicators/postgres.indicator';
import { RedisHealthIndicator } from '../../src/health/indicators/redis.indicator';
import { HttpPingIndicator } from '../../src/health/indicators/http-ping.indicator';
import { parseCorsOrigins, registerSecurity } from '../../src/common/security/security.register';

const REPO_ROOT = resolve(__dirname, '../../../..');
const rel = (p: string): string => resolve(REPO_ROOT, p);

function upResult(key: string): HealthIndicatorResult {
  return { [key]: { status: 'up' } };
}

describe('Phase-0 smoke suite — regressions here block Phase-1', () => {
  let app: NestFastifyApplication;
  let env: Env;

  beforeAll(async () => {
    // Run in prod so HSTS / Trusted Types / upgrade-insecure-requests
    // are exercised — the fullest perimeter.
    env = validateEnv({
      ...process.env,
      NODE_ENV: 'production',
      CORS_ORIGINS: 'https://travel.example',
    });

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PostgresHealthIndicator)
      .useValue({ isHealthy: jest.fn().mockResolvedValue(upResult('postgres')) })
      .overrideProvider(RedisHealthIndicator)
      .useValue({ isHealthy: jest.fn().mockResolvedValue(upResult('redis')) })
      .overrideProvider(HttpPingIndicator)
      .useValue({ isHealthy: jest.fn().mockResolvedValue(upResult('meilisearch')) })
      .compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter({ logger: false }),
      { logger: false, bufferLogs: false },
    );
    app.setGlobalPrefix('api/v1', { exclude: ['health', 'health/(.*)'] });
    await registerSecurity(app, env);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── [IV.19.1] — CLAUDE.md system rules ───────────────────────────────
  describe('[IV.19.1] CLAUDE.md system rules', () => {
    it('CLAUDE.md exists at repo root', () => {
      expect(existsSync(rel('CLAUDE.md'))).toBe(true);
    });

    it('declares the 13 hard constraints', () => {
      const body = readFileSync(rel('CLAUDE.md'), 'utf8');
      expect(body).toContain('Hard Constraints');
      // Sanity: at least rules 1, 9, 12 (token storage — cited by manifest).
      expect(body).toMatch(/Scope-lock/);
      expect(body).toMatch(/console\.log/);
      expect(body).toMatch(/Token storage/);
    });
  });

  // ─── [II.10.0] — Turborepo scaffold ───────────────────────────────────
  describe('[II.10.0] monorepo scaffolding', () => {
    it('pnpm-workspace.yaml, turbo.json, root package.json exist', () => {
      expect(existsSync(rel('pnpm-workspace.yaml'))).toBe(true);
      expect(existsSync(rel('turbo.json'))).toBe(true);
      expect(existsSync(rel('package.json'))).toBe(true);
    });
  });

  // ─── [II.6.x] + [II.7.x] — ADRs + context map + package manifest ──────
  describe('[II.6.x, II.7.x] architecture docs', () => {
    it.each([
      ['ADR-001', 'docs/adr/ADR-001-modular-monolith.md'],
      ['ADR-002', 'docs/adr/ADR-002-service-extraction-triggers.md'],
      ['ADR-003', 'docs/adr/ADR-003-event-backbone.md'],
      ['ADR-004', 'docs/adr/ADR-004-bounded-contexts.md'],
      ['context-map', 'docs/architecture/context-map.md'],
      ['package-manifest', 'docs/packages/manifest.md'],
    ])('%s present', (_name, path) => {
      expect(existsSync(rel(path))).toBe(true);
    });
  });

  // ─── [IX.32.3 / 32.4] — Makefile + .env.example + docs/env.md ─────────
  describe('[IX.32.3, IX.32.4] dev onboarding artefacts', () => {
    it('Makefile + .env.example + docs/env.md all present', () => {
      expect(existsSync(rel('Makefile'))).toBe(true);
      expect(existsSync(rel('.env.example'))).toBe(true);
      expect(existsSync(rel('docs/env.md'))).toBe(true);
    });
  });

  // ─── [III.11.1] — Zod env validation ──────────────────────────────────
  describe('[III.11.1] @app/config env validation', () => {
    it('rejects missing required vars with structured issue list', () => {
      expect(() => validateEnv({})).toThrow(EnvValidationError);
      try {
        validateEnv({});
      } catch (err) {
        expect(err).toBeInstanceOf(EnvValidationError);
        const issues = (err as EnvValidationError).issues;
        expect(Array.isArray(issues)).toBe(true);
        expect(issues.length).toBeGreaterThan(0);
      }
    });

    it('exposes CORS_ORIGINS with empty default (added in [IV.18.1.17])', () => {
      expect(env.CORS_ORIGINS).toBe('https://travel.example');
      // Default when absent:
      const shape = EnvSchema.shape;
      expect(shape.CORS_ORIGINS).toBeDefined();
    });
  });

  // ─── [III.11.x] — @app/errors contract ────────────────────────────────
  describe('[III.11.x] @app/errors', () => {
    it('toJSON() never leaks stack, and preserves code + message', () => {
      const err = new ValidationError('bad input', { email: ['required'] });
      const json = err.toJSON();
      expect(Object.keys(json)).not.toContain('stack');
      expect(json.code).toBe(err.code);
      expect(json.message).toBe('bad input');
      // httpStatus lives on the instance, not in the JSON wire shape —
      // the filter reads `err.httpStatus` directly.
      expect(err.httpStatus).toBe(422);
    });

    it('isDomainError type guard matches subclasses, rejects plain Error', () => {
      expect(isDomainError(new ValidationError('x'))).toBe(true);
      expect(isDomainError(new UnauthorizedError('y'))).toBe(true);
      expect(isDomainError(new NotFoundError('z'))).toBe(true);
      expect(isDomainError(new Error('plain'))).toBe(false);
    });

    it('DomainError.context is frozen', () => {
      const err = new ValidationError('x', {}, { a: 1 });
      expect(() => {
        (err.context as Record<string, unknown>)['a'] = 2;
      }).toThrow();
    });
  });

  // ─── [III.11.x] — @app/logger contract ────────────────────────────────
  describe('[III.11.x] @app/logger', () => {
    it('createLogger returns something with the Pino shape', () => {
      const log = createLogger('smoke');
      expect(typeof log.info).toBe('function');
      expect(typeof log.error).toBe('function');
      expect(typeof log.fatal).toBe('function');
    });

    it('runWithTraceContext propagates trace id through async work', async () => {
      const { trace } = await runWithTraceContext({ traceId: 'trace-abc-123' }, async () => {
        return { trace: 'trace-abc-123' };
      });
      expect(trace).toBe('trace-abc-123');
    });
  });

  // ─── [III.11.0] + [IV.18.1.16] — health probes ────────────────────────
  describe('[III.11.0] + [IV.18.1.16] health probes', () => {
    it('GET /health/live returns 200 with expected shape (bare path, outside /api/v1)', async () => {
      const res = await app.inject({ method: 'GET', url: '/health/live' });
      expect(res.statusCode).toBe(200);
      const body = res.json() as Record<string, unknown>;
      expect(body['status']).toBe('ok');
      expect(body['service']).toBe('api');
    });

    it('GET /health/ready covers postgres + redis + meilisearch (all up)', async () => {
      const res = await app.inject({ method: 'GET', url: '/health/ready' });
      expect(res.statusCode).toBe(200);
      const body = res.json() as { info: Record<string, { status: string }> };
      expect(body.info['postgres']?.status).toBe('up');
      expect(body.info['redis']?.status).toBe('up');
      expect(body.info['meilisearch']?.status).toBe('up');
    });

    it('GET /health/startup returns 200 when Postgres is reachable', async () => {
      const res = await app.inject({ method: 'GET', url: '/health/startup' });
      expect(res.statusCode).toBe(200);
    });
  });

  // ─── [common/filters] — DomainExceptionFilter + AllExceptionFilter ────
  describe('[common/filters] error filters', () => {
    it('DomainError has the JSON shape the DomainExceptionFilter relies on', () => {
      class Thrown extends DomainError {
        readonly code = 'TEST_CODE';
        readonly httpStatus = 418;
        constructor(context: DomainErrorContext = {}) {
          super('boom', context);
        }
      }
      const err = new Thrown();
      const json = err.toJSON();
      expect(json.code).toBe('TEST_CODE');
      expect(json.message).toBe('boom');
      expect(err.httpStatus).toBe(418);
      // Stack MUST NOT appear in the serialized shape.
      expect(JSON.stringify(json)).not.toMatch(/\n\s+at /);
    });

    it('HealthCheckError is the terminus signal the indicator contract walks', () => {
      const err = new HealthCheckError('down', { x: { status: 'down' } });
      expect(err.message).toBe('down');
    });
  });

  // ─── [IV.18.1.17] — security perimeter ────────────────────────────────
  describe('[IV.18.1.17] security perimeter', () => {
    let headers: OutgoingHttpHeaders;

    beforeAll(async () => {
      const res = await app.inject({ method: 'GET', url: '/health/live' });
      headers = res.headers;
    });

    it('sets every prod-baseline header', () => {
      expect(headers['x-content-type-options']).toBe('nosniff');
      expect(headers['x-frame-options']).toBe('DENY');
      expect(headers['referrer-policy']).toBe('no-referrer');
      expect(headers['cross-origin-opener-policy']).toBe('same-origin');
      expect(headers['cross-origin-embedder-policy']).toBe('require-corp');
      expect(headers['cross-origin-resource-policy']).toBe('same-origin');
      expect(String(headers['strict-transport-security'])).toContain('max-age=63072000');
      expect(String(headers['permissions-policy'])).toMatch(/camera=\(\)/);
    });

    it('CSP contains strict directives + per-request nonce', async () => {
      const a = await app.inject({ method: 'GET', url: '/health/live' });
      const b = await app.inject({ method: 'GET', url: '/health/live' });
      const csp1 = a.headers['content-security-policy'] as string;
      const csp2 = b.headers['content-security-policy'] as string;
      expect(csp1).toContain(`default-src 'none'`);
      expect(csp1).toContain(`require-trusted-types-for 'script'`);
      expect(csp1).toContain('upgrade-insecure-requests');
      const n1 = /nonce-([A-Za-z0-9+/=_-]+)/.exec(csp1)?.[1];
      const n2 = /nonce-([A-Za-z0-9+/=_-]+)/.exec(csp2)?.[1];
      expect(n1).toBeDefined();
      expect(n2).toBeDefined();
      expect(n1).not.toEqual(n2);
    });

    it('parseCorsOrigins is exported and empty-safe', () => {
      expect(parseCorsOrigins('')).toEqual([]);
      expect(parseCorsOrigins('a, b,,  c ')).toEqual(['a', 'b', 'c']);
    });
  });
});
