/**
 * k6 smoke test — minimal load to verify the rig + the API responds
 * to every health-critical endpoint. NOT a real load test; that's
 * `load.js`. Use this one for "is the deploy alive?" gating in CI/CD.
 *
 * Usage (local, against the running dev stack):
 *   k6 run infra/k6/scripts/smoke.js
 *
 * Usage (with a custom base URL, e.g. staging):
 *   k6 run -e BASE_URL=https://api.staging.example.com infra/k6/scripts/smoke.js
 *
 * Passing thresholds:
 *   - 0% request failures
 *   - p95 < 500ms across all checks (loose; the real SLO lives in load.js)
 *
 * Installed by prompt [IV.18.19.5].
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 1,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function smoke() {
  const live = http.get(`${BASE_URL}/health/live`);
  check(live, { 'live 200': (r) => r.status === 200 });

  const ready = http.get(`${BASE_URL}/health/ready`);
  check(ready, { 'ready 200': (r) => r.status === 200 });

  const metrics = http.get(`${BASE_URL}/metrics`);
  check(metrics, {
    'metrics 200': (r) => r.status === 200,
    'metrics has cache_hit_total': (r) => r.body.includes('cache_hit_total'),
    'metrics has http_request_duration_seconds': (r) =>
      r.body.includes('http_request_duration_seconds'),
  });

  // Public memory book listing — no auth required, exercises the
  // marketing-discovery surface from [IV.18.13.1].
  const featured = http.get(`${BASE_URL}/api/v1/memory-books/featured`);
  check(featured, { 'featured 200': (r) => r.status === 200 });

  // Public review summary surfaces — opaque ids accepted; verifies
  // the [IV.18.12.11..12] generalized composite is reachable. Using
  // the demo opaque ids from seed-demo.ts so a seeded deploy returns
  // populated counts.
  const placeReview = http.get(`${BASE_URL}/api/v1/places/demo-place-shibuya-xing/review-summary`);
  check(placeReview, { 'place review 200': (r) => r.status === 200 });

  sleep(1);
}
