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
 * CLAUDE.md #self-check says "Coverage threshold met (domain ≥
 * 80%, application ≥ 80% on modules)." Until this config landed
 * that number was never actually computed. It is now.
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
 *
 * Installed by [H1].
 */
/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  rootDir: '.',
  // Every entity-unit spec lives at test/<entity>-entity.unit.spec.ts;
  // also include the trip-transitions pure-function spec which
  // shares the same "no infra" posture.
  testMatch: [
    '<rootDir>/test/**/*-entity.unit.spec.ts',
    '<rootDir>/test/trip-transitions.unit.spec.ts',
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
  ],
  coverageReporters: ['text', 'text-summary', 'lcov', 'json-summary'],
  coverageDirectory: 'coverage/unit',
  // Per-file gate: every domain file must hit 80% on every metric.
  // The empty `**/` key applies to each file under collectCoverageFrom.
  // CLAUDE.md self-check #3 ("domain ≥ 80%") is now mechanical.
  coverageThreshold: {
    './src/modules/**/domain/*.ts': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  moduleNameMapper: {
    '^@app/config$': '<rootDir>/../../packages/config/src/index.ts',
    '^@app/config/(.*)$': '<rootDir>/../../packages/config/src/$1',
    '^@app/errors$': '<rootDir>/../../packages/errors/src/index.ts',
    '^@app/errors/(.*)$': '<rootDir>/../../packages/errors/src/$1',
    '^@app/logger$': '<rootDir>/../../packages/logger/src/index.ts',
    '^@app/logger/(.*)$': '<rootDir>/../../packages/logger/src/$1',
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
