/** @type {import('jest').Config} */
const path = require('node:path');
const PACKAGES = path.resolve(__dirname, '..');
module.exports = {
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/test/**/*.spec.ts'],
  moduleNameMapper: {
    '^@app/clock$': `${PACKAGES}/clock/src/index.ts`,
  },
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: {
          module: 'commonjs',
          target: 'ES2022',
          moduleResolution: 'node',
          esModuleInterop: true,
          strict: true,
          isolatedModules: true,
          skipLibCheck: true,
        },
      },
    ],
  },
};
