/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/test/**/*.spec.ts'],
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
          jsx: 'react-jsx',
          skipLibCheck: true,
          lib: ['ES2022', 'DOM', 'DOM.Iterable'],
        },
      },
    ],
  },
  moduleNameMapper: {
    '^@app/aether-motion$': '<rootDir>/../aether-motion/src/index.ts',
    '^@app/aether-motion/(.*)$': '<rootDir>/../aether-motion/src/$1.ts',
    '^@app/aether-core$': '<rootDir>/../aether-core/src/index.ts',
    '^@app/aether-core/(.*)$': '<rootDir>/../aether-core/src/$1.ts',
  },
};
