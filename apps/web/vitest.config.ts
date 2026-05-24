/**
 * Vitest config for apps/web ([I5]).
 *
 * Why vitest and not jest: Next 15 + React 19 + Server Components +
 * TypeScript + ESM all play noticeably better with vitest's esbuild
 * pipeline than with ts-jest. The api side stays on jest because of
 * the heavy Nest decorator metadata, but a UI component test that
 * just renders a React tree has no Nest, no Prisma, no global
 * `reflect-metadata` import to fight with.
 *
 * Test environment: jsdom — RTL queries against a real DOM tree.
 * `setupFiles` wires `@testing-library/jest-dom` matchers + a
 * cleanup-between-tests hook.
 *
 * Coverage thresholds: per-file ≥80% (same posture as the api
 * coverage gate, [H1]). Starter scope is the `components/ui/`
 * primitives + a few composites; expand as PRs land tests.
 *
 * Installed by prompt [I5].
 */
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.spec.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'lcov', 'json-summary'],
      reportsDirectory: './coverage/unit',
      // Per-file gate scoped to the components currently covered.
      // Add new entries as tests land — same lockstep posture as
      // apps/api/jest.config.unit.cjs.
      include: [
        // I5 starter
        'src/components/ui/badge.tsx',
        'src/components/ui/button.tsx',
        'src/components/ui/empty-state.tsx',
        // K2 expansion — form primitives + layout + loading states
        'src/components/ui/card.tsx',
        'src/components/ui/input.tsx',
        'src/components/ui/relative-time.tsx',
        'src/components/ui/select.tsx',
        'src/components/ui/skeleton.tsx',
      ],
      thresholds: {
        perFile: true,
        lines: 80,
        functions: 80,
        statements: 80,
        branches: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
