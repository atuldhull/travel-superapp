/**
 * e2e for `ZodValidationPipe` ([III.13.1]).
 *
 * Covers both the pipe's own parsing contract AND its integration with
 * `DomainExceptionFilter` ([III.11.5]) — the pipe throws
 * `ValidationError`, the filter renders 422 with `fieldErrors` in the
 * response body. That's the end-to-end behaviour callers depend on.
 *
 * Uses a test-only `DebugValidationController` wired in a throw-away
 * Nest module; never in `AppModule`.
 */
import { Body, Controller, Get, Module, Post, Query } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { z } from 'zod';
import { AllExceptionFilter } from '../src/common/filters/all-exception.filter';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { ZodValidationPipe } from '../src/common/pipes/zod-validation.pipe';

// ─── Schemas under test ─────────────────────────────────────────────────
const CreateTripSchema = z.object({
  title: z.string().min(1),
  radiusKm: z.coerce.number().int().positive().max(500),
  center: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
});

const StringQuerySchema = z.object({
  q: z.string().min(2),
  limit: z.coerce.number().int().positive().max(100).default(10),
});

// ─── Test controller ────────────────────────────────────────────────────
@Controller('debug')
class DebugValidationController {
  @Post('trips')
  createTrip(@Body(new ZodValidationPipe(CreateTripSchema)) dto: z.infer<typeof CreateTripSchema>) {
    // Round-trip the parsed value so assertions can inspect it.
    return { ok: true, dto };
  }

  @Get('search')
  search(
    @Query(new ZodValidationPipe(StringQuerySchema)) query: z.infer<typeof StringQuerySchema>,
  ) {
    return { ok: true, query };
  }
}

@Module({ controllers: [DebugValidationController] })
class PipeTestModule {}

// ─── Suite ──────────────────────────────────────────────────────────────
describe('ZodValidationPipe (e2e)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [PipeTestModule] }).compile();
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

  // ─── Happy path ──────────────────────────────────────────────────────
  it('accepts a valid body and returns the parsed dto (types/coercion applied)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/debug/trips',
      payload: {
        title: 'Weekend in Bengaluru',
        radiusKm: '25', // string — must be coerced to number
        center: { lat: 12.9716, lng: 77.5946 },
      },
      headers: { 'content-type': 'application/json' },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json() as { ok: boolean; dto: { radiusKm: number; title: string } };
    expect(body.ok).toBe(true);
    expect(body.dto.radiusKm).toBe(25);
    expect(typeof body.dto.radiusKm).toBe('number');
    expect(body.dto.title).toBe('Weekend in Bengaluru');
  });

  it('applies defaults for optional fields (via @Get + @Query)', async () => {
    const res = await app.inject({ method: 'GET', url: '/debug/search?q=himalayas' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { query: { q: string; limit: number } };
    expect(body.query).toEqual({ q: 'himalayas', limit: 10 });
  });

  // ─── Validation failures surface through the filter ──────────────────
  it('missing required field → 422 with fieldErrors.title populated', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/debug/trips',
      payload: { radiusKm: 25, center: { lat: 0, lng: 0 } },
      headers: { 'content-type': 'application/json' },
    });
    expect(res.statusCode).toBe(422);
    const body = res.json() as { code: string; fieldErrors: Record<string, string[]> };
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(body.fieldErrors).toHaveProperty('title');
    expect(body.fieldErrors['title']?.length ?? 0).toBeGreaterThan(0);
  });

  it('wrong type → 422 with the offending path reported', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/debug/trips',
      payload: {
        title: 'x',
        radiusKm: 'not-a-number',
        center: { lat: 0, lng: 0 },
      },
      headers: { 'content-type': 'application/json' },
    });
    expect(res.statusCode).toBe(422);
    const body = res.json() as { fieldErrors: Record<string, string[]> };
    expect(body.fieldErrors).toHaveProperty('radiusKm');
  });

  it('nested field errors use dot-path keys (center.lat)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/debug/trips',
      payload: {
        title: 'x',
        radiusKm: 25,
        center: { lat: 999, lng: 0 }, // out of range
      },
      headers: { 'content-type': 'application/json' },
    });
    expect(res.statusCode).toBe(422);
    const body = res.json() as { fieldErrors: Record<string, string[]> };
    // Use bracket access — `toHaveProperty('center.lat')` would read
    // "center" > "lat" as a nested path, not the literal key.
    expect('center.lat' in body.fieldErrors).toBe(true);
    expect(body.fieldErrors['center.lat']?.length ?? 0).toBeGreaterThan(0);
  });

  it('unknown key at the root → 422 with the key surfaced explicitly', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/debug/trips',
      payload: {
        title: 'x',
        radiusKm: 25,
        center: { lat: 0, lng: 0 },
        malicious: 'extra field',
      },
      headers: { 'content-type': 'application/json' },
    });
    expect(res.statusCode).toBe(422);
    const body = res.json() as { fieldErrors: Record<string, string[]> };
    expect(body.fieldErrors).toHaveProperty('malicious');
    expect(body.fieldErrors['malicious']).toEqual(['unrecognized key']);
  });

  it('multiple independent errors → all surfaced in one response', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/debug/trips',
      payload: {
        title: '',
        radiusKm: -5,
        center: { lat: 0, lng: 500 },
      },
      headers: { 'content-type': 'application/json' },
    });
    expect(res.statusCode).toBe(422);
    const body = res.json() as { fieldErrors: Record<string, string[]> };
    expect(Object.keys(body.fieldErrors).sort()).toEqual(
      expect.arrayContaining(['title', 'radiusKm', 'center.lng']),
    );
  });

  it('query-string validation also surfaces fieldErrors (via @Query)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/debug/search?q=x&limit=9999', // q too short, limit too large
    });
    expect(res.statusCode).toBe(422);
    const body = res.json() as { fieldErrors: Record<string, string[]> };
    expect(body.fieldErrors['q']?.length ?? 0).toBeGreaterThan(0);
    expect(body.fieldErrors['limit']?.length ?? 0).toBeGreaterThan(0);
  });

  // ─── Response shape ──────────────────────────────────────────────────
  it('422 payload shape matches the DomainExceptionFilter contract', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/debug/trips',
      payload: {},
      headers: { 'content-type': 'application/json' },
    });
    expect(res.statusCode).toBe(422);
    const body = res.json() as Record<string, unknown>;
    expect(body['code']).toBe('VALIDATION_FAILED');
    expect(body['message']).toBe('Validation failed');
    expect(body).toHaveProperty('fieldErrors');
    expect(body).toHaveProperty('timestamp');
    expect(body).toHaveProperty('context');
    // `source` + `field` ride along for observability, never include PII.
    const ctx = body['context'] as Record<string, unknown>;
    expect(ctx['source']).toBe('body');
  });
});
