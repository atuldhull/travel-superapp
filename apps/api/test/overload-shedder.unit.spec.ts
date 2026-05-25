/**
 * Pure unit tests for `shouldShed` — the load-shedder's decision
 * function. The Fastify integration test (which lives in
 * `apps/api/test/health.e2e-spec.ts` once we extend it) covers the
 * wire side; this spec covers the pure logic so a regression to the
 * bypass invariants is caught in 2ms instead of a 30s e2e run.
 */
import { shouldShed } from '../src/common/overload/overload.shedder';

const opts = {
  eventLoopLagMs: 100,
  maxInFlight: 200,
  samplerMs: 500,
  bypassPrefixes: ['/health/', '/api/v1/health/', '/metrics'],
} as const;

describe('overload shedder — shouldShed()', () => {
  it('returns null when the request is healthy', () => {
    expect(shouldShed({ meanLagMs: 5, inFlight: 10, shed: 0 }, opts, '/api/v1/trips')).toBeNull();
  });

  it('sheds when event-loop lag exceeds threshold', () => {
    const decision = shouldShed({ meanLagMs: 150, inFlight: 5, shed: 0 }, opts, '/api/v1/trips');
    expect(decision).toEqual({ reason: 'event_loop_lag', detail: 150 });
  });

  it('sheds when in-flight count is at cap', () => {
    const decision = shouldShed({ meanLagMs: 10, inFlight: 200, shed: 0 }, opts, '/api/v1/trips');
    expect(decision).toEqual({ reason: 'in_flight_cap', detail: 200 });
  });

  it('lag takes precedence over in-flight when both are hot', () => {
    const decision = shouldShed({ meanLagMs: 200, inFlight: 500, shed: 0 }, opts, '/api/v1/trips');
    expect(decision?.reason).toBe('event_loop_lag');
  });

  it('NEVER sheds /health/* — orchestrator probes always pass', () => {
    const hot = { meanLagMs: 9999, inFlight: 9999, shed: 0 };
    expect(shouldShed(hot, opts, '/health/ready')).toBeNull();
    expect(shouldShed(hot, opts, '/health/live')).toBeNull();
    expect(shouldShed(hot, opts, '/api/v1/health/ready')).toBeNull();
  });

  it('NEVER sheds /metrics — Prometheus scrape during overload is most-needed', () => {
    expect(shouldShed({ meanLagMs: 9999, inFlight: 9999, shed: 0 }, opts, '/metrics')).toBeNull();
  });

  it('does NOT bypass routes that merely contain "health" as a substring', () => {
    // /api/v1/safety/scams should NOT be bypassed even though "health"
    // doesn't appear — and a hypothetical /trips/healthy-snacks should
    // NOT be bypassed either. Verified by the strict prefix check.
    expect(
      shouldShed({ meanLagMs: 200, inFlight: 0, shed: 0 }, opts, '/api/v1/trips/healthy-snacks'),
    ).toEqual({ reason: 'event_loop_lag', detail: 200 });
  });
});
