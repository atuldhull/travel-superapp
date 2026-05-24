/**
 * k6 stress test for the API ([J3]).
 *
 * "Where does it break?" Smoke verifies the steady state; stress
 * pushes past it until thresholds breach or the service falls over.
 * Knowing the cliff is the difference between "we can handle launch
 * traffic" and "we hope we can."
 *
 * Stages: 1m ramp 0→100 → 3m steady → 1m ramp to 200 → 3m steady →
 *         1m ramp to 400 → 3m steady → 1m ramp down. ~13 min total.
 *
 * Thresholds are LOOSER than smoke.js — under stress we tolerate
 * p95 < 2s + p99 < 5s + error rate < 5%. The job FAILS only if
 * the API actually falls over; reviewers eyeball the trends in the
 * uploaded HTML report.
 *
 * Run locally:
 *   k6 run --env API_BASE=http://localhost:3000 load/stress.js
 *
 * Trigger in CI: workflow_dispatch on the `load-stress` job — opt-in
 * because it's 13 min of CI time + actually loads the service.
 *
 * Installed by prompt [J3].
 */
import http from 'k6/http';
import { check, group, sleep } from 'k6';

const API_BASE = __ENV.API_BASE || 'http://localhost:3000';

export const options = {
  stages: [
    { duration: '1m', target: 100 },
    { duration: '3m', target: 100 },
    { duration: '1m', target: 200 },
    { duration: '3m', target: 200 },
    { duration: '1m', target: 400 },
    { duration: '3m', target: 400 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    // Looser than smoke. Under stress the goal is "doesn't die,"
    // not "still snappy" — that's what smoke is for.
    http_req_duration: ['p(95)<2000', 'p(99)<5000'],
    http_req_failed: ['rate<0.05'],
    // Readiness probe still has a tight error budget — if it flaps
    // the autoscaler will, too.
    'http_req_failed{endpoint:health_ready}': ['rate<0.005'],
  },
};

function get(path, tag) {
  const res = http.get(`${API_BASE}${path}`, { tags: { endpoint: tag } });
  check(res, { [`${tag} status < 500`]: (r) => r.status < 500 });
}

export default function () {
  group('health', () => {
    get('/api/v1/health/live', 'health_live');
    get('/api/v1/health/ready', 'health_ready');
  });
  group('public feed', () => {
    get('/api/v1/featured', 'featured');
    get('/api/v1/feed/public', 'feed_public');
  });
  // Shorter think-time than smoke — stress = realistic peak burst.
  sleep(0.5);
}
