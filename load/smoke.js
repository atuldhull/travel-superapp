/**
 * k6 smoke load test for the API ([I7]).
 *
 * Smoke ≠ stress. The goal here isn't "find the breaking point" —
 * it's "verify the service responds within budget under a realistic
 * concurrent load, so CI catches a p95 regression of 10× the moment
 * it lands instead of finding it from a customer ticket."
 *
 * Stages: 1m ramp 0→20 VUs → 2m steady at 20 → 30s ramp-down. Five
 * hot, no-auth endpoints (most pages that load before login):
 *
 *   GET  /api/v1/health/live      — Nest health, always-cheap
 *   GET  /api/v1/health/ready     — Postgres + Redis ping
 *   GET  /metrics                 — Prometheus scrape
 *   GET  /api/v1/featured         — trip-publication list
 *   GET  /api/v1/feed/public      — public feed
 *
 * Thresholds (each FAILS the run if breached):
 *   - http_req_duration p(95) < 500ms  — generous, conservative
 *   - http_req_failed       < 1%       — request-level errors
 *   - http_req_failed for /health/ready < 0.1% (tighter — readiness
 *     can't flap during a smoke)
 *
 * Run locally:
 *   k6 run --env API_BASE=http://localhost:3000 load/smoke.js
 *
 * Run in CI via the `load` job in .github/workflows/ci.yml.
 *
 * Installed by prompt [I7].
 */
import http from 'k6/http';
import { check, group, sleep } from 'k6';

const API_BASE = __ENV.API_BASE || 'http://localhost:3000';

export const options = {
  stages: [
    { duration: '1m', target: 20 }, // ramp 0 → 20 VUs
    { duration: '2m', target: 20 }, // steady state
    { duration: '30s', target: 0 }, // ramp down
  ],
  thresholds: {
    // Global: p95 + p99 + error rate. p99 is the gate the review
    // explicitly called out — the tail latency that defines user-
    // perceived speed for the 1% who hit the slowest path. p99 ≤
    // 2× p95 is the operational expectation; if p99 spikes without
    // p95 moving, it's a hot-shard / lock-contention smell.
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
    // Health readiness must be near-perfect during a smoke.
    'http_req_failed{endpoint:health_ready}': ['rate<0.001'],
    // Per-endpoint p95 + p99 budgets.
    'http_req_duration{endpoint:health_live}': ['p(95)<50', 'p(99)<100'],
    'http_req_duration{endpoint:health_ready}': ['p(95)<150', 'p(99)<300'],
    'http_req_duration{endpoint:metrics}': ['p(95)<100', 'p(99)<200'],
    'http_req_duration{endpoint:featured}': ['p(95)<500', 'p(99)<1000'],
    'http_req_duration{endpoint:feed_public}': ['p(95)<500', 'p(99)<1000'],
  },
};

function get(path, tag) {
  const res = http.get(`${API_BASE}${path}`, {
    tags: { endpoint: tag },
  });
  check(res, {
    [`${tag} status < 500`]: (r) => r.status < 500,
  });
  return res;
}

export default function () {
  group('health', () => {
    get('/api/v1/health/live', 'health_live');
    get('/api/v1/health/ready', 'health_ready');
  });
  group('observability', () => {
    get('/metrics', 'metrics');
  });
  group('public feed', () => {
    get('/api/v1/featured', 'featured');
    get('/api/v1/feed/public', 'feed_public');
  });
  // Realistic think-time between iterations.
  sleep(1);
}
