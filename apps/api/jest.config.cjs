/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: [
    '<rootDir>/test/**/*.spec.ts',
    '<rootDir>/test/**/*.e2e-spec.ts',
    '<rootDir>/test/**/*.smoke.ts',
  ],
  // [L6] quarantine. Tests under `test/quarantine/` run INFORMATIONALLY
  // in their own job — known-flaky cases that shouldn't block PRs
  // while we root-cause them. The main testPathIgnorePatterns kicks
  // them out of the default run.
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/test/quarantine/'],
  setupFiles: ['<rootDir>/test/setup.ts'],
  // [M3] jest-junit reporter persists pass/fail per test ID + per
  // worker. CI uploads `apps/api/test-results/**/*.xml` as an artifact
  // and the nightly `flake-trends.yml` workflow aggregates the last
  // 10 days to surface "this test failed N of last 10 runs" without
  // standing up a paid dashboard. Closes #8 of the road-to-10 list.
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: '<rootDir>/test-results',
        outputName: 'junit-w${JEST_WORKER_ID}.xml',
        // Hyphen-joined classnames + suite-prefixed test names so the
        // aggregator can group by `<file>::<test>` uniquely across
        // shards. Avoids the "two tests named 'works' in different
        // files merging into one row" trap.
        classNameTemplate: '{filepath}',
        titleTemplate: '{classname} :: {title}',
        ancestorSeparator: ' > ',
      },
    ],
  ],
  // [L1] globalSetup decides between Docker compose / CI services /
  // Testcontainers and writes DATABASE_URL + REDIS_URL into the env;
  // it also pre-creates per-worker Postgres schemas (test_w1..8) and
  // runs `prisma migrate deploy` on each. globalTeardown stops any
  // Testcontainers started during globalSetup.
  globalSetup: '<rootDir>/test/global-setup.ts',
  globalTeardown: '<rootDir>/test/global-teardown.ts',
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/main.ts'],
  coverageReporters: ['text', 'lcov'],
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
  testTimeout: 15_000,
};
