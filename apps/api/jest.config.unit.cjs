/**
 * Unit-only Jest config + coverage gate ([H1]).
 *
 * Why a separate config: the main `jest.config.cjs` runs the full
 * .spec.ts + .e2e-spec.ts surface and needs Postgres / Redis /
 * S3 to be up. The DOMAIN unit specs ([F4] + [G4]) are pure
 * functions — no DB, no Nest, no mocks. We can run them in
 * sub-3-second wall clock and produce honest, enforceable
 * coverage numbers from a clean checkout (no docker compose).
 *
 * The project's coverage bar is "domain ≥ 80%, application ≥ 80% on
 * modules". Until this config landed that number was never actually
 * computed. It is now.
 *
 * `collectCoverageFrom` lists the EXACT files the unit specs
 * exercise — adding a new file here without a matching unit spec
 * makes the gate fail (no coverage on that file), which is
 * exactly the signal we want.
 *
 * Threshold matrix: 80% for every metric, applied PER FILE (not
 * just globally). Per-file is stricter and stops a 95% file from
 * masking a 60% file in the global average — the dishonest-number
 * failure mode the playbook explicitly calls out.
 */
// Absolute path to the workspace packages dir — required so the
// moduleNameMapper survives Stryker's sandbox copy ([H2]). Inside
// the sandbox `<rootDir>` resolves to `.stryker-tmp/sandbox-XXXX/`,
// where `../../packages` doesn't exist.
const path = require('node:path');
const PACKAGES = path.resolve(__dirname, '..', '..', 'packages');

/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  rootDir: '.',
  // Every entity-unit spec lives at test/<entity>-entity.unit.spec.ts;
  // also include the trip-transitions pure-function spec, the
  // [I1] factory smoke specs, and the [I2] property-based specs
  // (`*-entity.property.spec.ts`) — all share the "no infra" posture.
  testMatch: [
    '<rootDir>/test/**/*-entity.unit.spec.ts',
    '<rootDir>/test/**/*-entity.property.spec.ts',
    '<rootDir>/test/trip-transitions.unit.spec.ts',
    '<rootDir>/test/itinerary-day-summaries.unit.spec.ts',
    '<rootDir>/test/factories.unit.spec.ts',
    '<rootDir>/test/contract.*.spec.ts',
    '<rootDir>/test/geo-math.property.spec.ts',
    '<rootDir>/test/overload-shedder.unit.spec.ts',
  ],
  setupFiles: ['<rootDir>/test/setup.ts'],
  collectCoverage: true,
  // The 11 domain entities that have unit specs + the trip
  // transition module. New entity work that lands without a unit
  // spec fails the gate (file appears here → forces a spec).
  collectCoverageFrom: [
    'src/modules/social/domain/expense.entity.ts',
    'src/modules/social/domain/review.entity.ts',
    'src/modules/social/domain/trip-comment.entity.ts',
    'src/modules/social/domain/vote.entity.ts',
    'src/modules/safety/domain/scam-report.entity.ts',
    'src/modules/safety/domain/sos-event.entity.ts',
    'src/modules/safety/domain/agent-profile.entity.ts',
    'src/modules/media/domain/media-asset.entity.ts',
    'src/modules/account/domain/trusted-contact.entity.ts',
    'src/modules/diary/domain/diary-entry.entity.ts',
    'src/modules/trip/domain/itinerary.entity.ts',
    'src/modules/trip/domain/trip-transitions.ts',
    'src/common/geo/haversine.ts',
  ],
  coverageReporters: ['text', 'text-summary', 'lcov', 'json-summary'],
  coverageDirectory: 'coverage/unit',
  // Per-file gate: every domain file must hit 80% on every metric.
  // The empty `**/` key applies to each file under collectCoverageFrom.
  // The "domain ≥ 80%" bar is now mechanical, not a promise.
  coverageThreshold: {
    './src/modules/**/domain/*.ts': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    './src/common/geo/haversine.ts': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  moduleNameMapper: {
    '^@app/config$': `${PACKAGES}/config/src/index.ts`,
    '^@app/config/(.*)$': `${PACKAGES}/config/src/$1`,
    '^@app/errors$': `${PACKAGES}/errors/src/index.ts`,
    '^@app/errors/(.*)$': `${PACKAGES}/errors/src/$1`,
    '^@app/logger$': `${PACKAGES}/logger/src/index.ts`,
    '^@app/logger/(.*)$': `${PACKAGES}/logger/src/$1`,
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          module: 'commonjs',
          target: 'ES2022',
          moduleResolution: 'node',
          esModuleInterop: true,
          strict: true,
          isolatedModules: true,
          experimentalDecorators: true,
          emitDecoratorMetadata: true,
          skipLibCheck: true,
        },
      },
    ],
  },
  testTimeout: 5_000,
};
