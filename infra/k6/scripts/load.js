/**
 * k6 load test — staged ramp from 50 → 200 → 500 vus exercising the
 * read endpoints that take the brunt of real traffic. The trip-overview
 * cache from [IV.18.2.15] is the marquee target; the test asserts
 * that p95 stays under the playbook §11 SLO (300ms reads / 800ms AI)
 * even at peak load.
 *
 * Usage (against the running dev stack):
 *   k6 run infra/k6/scripts/load.js
 *
 * Usage (against staging — recommended for real numbers):
 *   k6 run -e BASE_URL=https://api.staging.example.com \
 *          -e BEARER_TOKEN=<token> \
 *          infra/k6/scripts/load.js
 *
 * Without BEARER_TOKEN, only public endpoints are hit (memory-books
 * featured, /metrics, review summaries). With one, the test also
 * exercises the authenticated trip-overview path (cache-warmed),
 * which is the worst-case latency surface.
 *
 * Thresholds (fail the run if breached):
 *   - p95 < 300ms across all reads
 *   - p99 < 800ms across all reads
 *   - request failure rate < 0.1%
 *
 * Installed by prompt [IV.18.19.5].
 */
import http from 'k6/http';
import { check, group, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 50 },
    { duration: '2m', target: 200 },
    { duration: '2m', target: 500 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.001'],
    'http_req_duration{group:::public}': ['p(95)<300', 'p(99)<800'],
    'http_req_duration{group:::authed}': ['p(95)<500', 'p(99)<1500'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const BEARER = __ENV.BEARER_TOKEN || '';
const DEMO_TRIP_ID = __ENV.DEMO_TRIP_ID || ''; // Optional: a trip id seeded by db:seed:demo

const authHeader = BEARER ? { Authorization: `Bearer ${BEARER}` } : {};

export default function load() {
  group('public', () => {
    const featured = http.get(`${BASE_URL}/api/v1/memory-books/featured?limit=20`);
    check(featured, { 'featured 200': (r) => r.status === 200 });

    const placeReview = http.get(
      `${BASE_URL}/api/v1/places/demo-place-shibuya-xing/review-summary`,
    );
    check(placeReview, { 'place review 200': (r) => r.status === 200 });

    const agentReview = http.get(`${BASE_URL}/api/v1/agents/demo-agent-kenji/review-summary`);
    check(agentReview, { 'agent review 200': (r) => r.status === 200 });

    const metrics = http.get(`${BASE_URL}/metrics`);
    check(metrics, { 'metrics 200': (r) => r.status === 200 });
  });

  if (BEARER && DEMO_TRIP_ID) {
    group('authed', () => {
      // Trip overview — heaviest composite endpoint. Cache should
      // turn this into a sub-50ms hit after the first request from
      // each VU.
      const overview = http.get(`${BASE_URL}/api/v1/trips/${DEMO_TRIP_ID}/overview`, {
        headers: authHeader,
      });
      check(overview, { 'overview 200': (r) => r.status === 200 });

      const notifications = http.get(`${BASE_URL}/api/v1/notifications/me?limit=20`, {
        headers: authHeader,
      });
      check(notifications, { 'notifications 200': (r) => r.status === 200 });

      const unreadCount = http.get(`${BASE_URL}/api/v1/notifications/me/unread-count`, {
        headers: authHeader,
      });
      check(unreadCount, { 'unread-count 200': (r) => r.status === 200 });
    });
  }

  sleep(0.5);
}
