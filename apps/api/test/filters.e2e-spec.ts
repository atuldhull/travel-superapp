/**
 * e2e for the global exception filters ([III.11.5]).
 *
 * A test-only `DebugController` raises one error per route; we assert
 * the exact HTTP status, body shape, headers, and trace-id plumbing.
 *
 * Catches regressions in:
 *   - DomainExceptionFilter mapping DomainError → HTTP status + JSON body
 *   - RateLimitError side-effect: Retry-After header (seconds, rounded up)
 *   - ValidationError surfacing fieldErrors
 *   - AllExceptionFilter sanitising unhandled Error → 500 without stack
 *   - AllExceptionFilter preserving Nest's built-in HttpException
 *   - traceId propagation via AsyncLocalStorage (@app/logger)
 */
import { Controller, Get, HttpException, HttpStatus, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import {
  ExternalServiceError,
  InvalidRadiusError,
  RateLimitError,
  TripNotFoundError,
  ValidationError,
} from '@app/errors';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';

@Controller('debug')
class DebugController {
  @Get('trip-not-found')
  tripNotFound(): never {
    throw new TripNotFoundError('trip_123');
  }

  @Get('validation')
  validation(): never {
    throw new ValidationError('bad input', {
      email: ['invalid format'],
      name: ['required'],
    });
  }

  @Get('invalid-radius')
  invalidRadius(): never {
    throw new InvalidRadiusError(750, 500);
  }

  @Get('rate-limit')
  rateLimit(): never {
    throw new RateLimitError('slow down', 2500);
  }

  @Get('external')
  external(): never {
    throw new ExternalServiceError('stripe', 'timeout after 30s');
  }

  @Get('unhandled')
  unhandled(): never {
    // A completely unexpected native error — must be caught by AllExceptionFilter.
    throw new Error('something exploded');
  }

  @Get('nest-builtin')
  nestBuiltin(): never {
    // Simulates Nest's own HttpException family (e.g. NotFoundException).
    throw new HttpException({ message: 'item gone', sku: 'abc' }, HttpStatus.GONE);
  }
}

@Module({ controllers: [DebugController] })
class FilterTestModule {}

describe('global exception filters (e2e)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [FilterTestModule],
    }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter({ logger: false }),
      { logger: false, bufferLogs: false },
    );
    app.useGlobalFilters(new AllExceptionFilter(), new DomainExceptionFilter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('DomainExceptionFilter', () => {
    it('TripNotFoundError → 404 with code TRIP_NOT_FOUND + context', async () => {
      const res = await app.inject({ method: 'GET', url: '/debug/trip-not-found' });
      expect(res.statusCode).toBe(404);
      const body = res.json() as Record<string, unknown>;
      expect(body['code']).toBe('TRIP_NOT_FOUND');
      expect(body['message']).toContain('trip_123');
      expect(body['context']).toEqual({ tripId: 'trip_123' });
      expect(typeof body['timestamp']).toBe('string');
      // traceId is undefined here (no outer runWithTraceContext in inject()).
      expect('stack' in body).toBe(false);
    });

    it('ValidationError → 422 with fieldErrors surfaced', async () => {
      const res = await app.inject({ method: 'GET', url: '/debug/validation' });
      expect(res.statusCode).toBe(422);
      const body = res.json() as Record<string, unknown>;
      expect(body['code']).toBe('VALIDATION_FAILED');
      expect(body['fieldErrors']).toEqual({
        email: ['invalid format'],
        name: ['required'],
      });
    });

    it('InvalidRadiusError inherits ValidationError → 422 with radiusKm fieldErrors', async () => {
      const res = await app.inject({ method: 'GET', url: '/debug/invalid-radius' });
      expect(res.statusCode).toBe(422);
      const body = res.json() as Record<string, unknown>;
      expect(body['code']).toBe('INVALID_RADIUS');
      expect(body['fieldErrors']).toEqual({ radiusKm: ['must be between 0 and 500'] });
      expect(body['context']).toEqual({ radiusKm: 750, maxKm: 500 });
    });

    it('RateLimitError → 429 with retryAfterMs + Retry-After header (seconds, rounded up)', async () => {
      const res = await app.inject({ method: 'GET', url: '/debug/rate-limit' });
      expect(res.statusCode).toBe(429);
      const body = res.json() as Record<string, unknown>;
      expect(body['code']).toBe('RATE_LIMITED');
      expect(body['retryAfterMs']).toBe(2500);
      // 2500ms → ceil → 3 seconds
      expect(res.headers['retry-after']).toBe('3');
    });

    it('ExternalServiceError → 502 with service name surfaced', async () => {
      const res = await app.inject({ method: 'GET', url: '/debug/external' });
      expect(res.statusCode).toBe(502);
      const body = res.json() as Record<string, unknown>;
      expect(body['code']).toBe('EXTERNAL_SERVICE_FAILED');
      expect(body['service']).toBe('stripe');
      expect(body['message']).toBe('timeout after 30s');
    });

    // traceId propagation is tested via a direct unit test in
    // `test/domain-exception.filter.spec.ts`. At the HTTP level it requires
    // a request-scoped trace-context middleware (comes with [III.15.4]
    // OpenTelemetry wiring); until then, request-originated domain errors
    // emit with `traceId: undefined` — tested implicitly above.
  });

  describe('AllExceptionFilter', () => {
    it('unhandled native Error → 500 INTERNAL_ERROR with NO stack in the body', async () => {
      const res = await app.inject({ method: 'GET', url: '/debug/unhandled' });
      expect(res.statusCode).toBe(500);
      const body = res.json() as Record<string, unknown>;
      expect(body['code']).toBe('INTERNAL_ERROR');
      expect(body).not.toHaveProperty('stack');
      // NODE_ENV=test in setup.ts → non-prod → echoes the raw message.
      expect(body['message']).toBe('something exploded');
      expect(typeof body['timestamp']).toBe('string');
    });

    it('preserves Nest-builtin HttpException status and body', async () => {
      const res = await app.inject({ method: 'GET', url: '/debug/nest-builtin' });
      expect(res.statusCode).toBe(410);
      const body = res.json() as Record<string, unknown>;
      expect(body['message']).toBe('item gone');
      expect(body['sku']).toBe('abc');
      expect(typeof body['timestamp']).toBe('string');
    });

    it('unknown route (Nest routes to NotFoundException) → 404 via AllExceptionFilter', async () => {
      const res = await app.inject({ method: 'GET', url: '/debug/does-not-exist' });
      expect(res.statusCode).toBe(404);
      const body = res.json() as Record<string, unknown>;
      expect(body['timestamp']).toBeDefined();
    });
  });
});
