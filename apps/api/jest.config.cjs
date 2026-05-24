/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: [
    '<rootDir>/test/**/*.spec.ts',
    '<rootDir>/test/**/*.e2e-spec.ts',
    '<rootDir>/test/**/*.smoke.ts',
  ],
  setupFiles: ['<rootDir>/test/setup.ts'],
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
