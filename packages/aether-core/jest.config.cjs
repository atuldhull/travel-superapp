/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'jsdom',
  rootDir: '.',
  testMatch: ['<rootDir>/test/**/*.spec.ts', '<rootDir>/test/**/*.spec.tsx'],
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
  },
};
