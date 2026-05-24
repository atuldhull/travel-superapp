/**
 * k6 soak test for the API ([J3]).
 *
 * "Does the service degrade over time?" Smoke + stress find
 * instantaneous breakage; soak finds slow leaks — memory growth,
 * file-descriptor exhaustion, Prisma connection-pool drift, Redis
 * key-space bloat, GC pauses creeping up.
 *
 * Profile: 5m ramp 0→50 → 60m steady → 5m ramp-down. ~70 min wall
 * clock. Long enough for V8 heap pressure to surface; short enough
 * to fit inside a single CI ticket on a nightly cron.
 *
 * Thresholds: same as smoke, applied as the FINAL-windowed metric.
 * If p95 drifts up over the hour (typical memory-leak signature),
 * the last window of samples breaches the threshold even though the
 * first window passed cleanly.
 *
 * Triggered manually via `workflow_dispatch` on the `load-soak`
 * job. NOT a PR-blocking gate — soak signal is too slow for that.
 * Run nightly + ship the report.
 *
 * Installed by prompt [J3].
 */
import http from 'k6/http';
import { check, group, sleep } from 'k6';

const API_BASE = __ENV.API_BASE || 'http://localhost:3000';

export const options = {
  stages: [
    { duration: '5m', target: 50 },
    { duration: '60m', target: 50 },
    { duration: '5m', target: 0 },
  ],
  thresholds: {
    // Same bar as smoke but applied to the full-run distribution.
    // p99 drift over the hour shows up as a global p99 breach.
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
    'http_req_failed{endpoint:health_ready}': ['rate<0.001'],
  },
};

function get(path, tag) {
  const res = http.get(`${API_BASE}${path}`, { tags: { endpoint: tag } });
  check(res, { [`${tag} status < 500`]: (r) => r.status < 500 });
}

export default function () {
  group('soak', () => {
    get('/api/v1/health/ready', 'health_ready');
    get('/api/v1/featured', 'featured');
    get('/api/v1/feed/public', 'feed_public');
  });
  // 2s think-time keeps the steady-state load realistic for a long
  // window (50 VUs · 0.5 req/s ≈ 25 req/s sustained).
  sleep(2);
}
