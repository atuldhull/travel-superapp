/**
 * Vitest global setup for apps/web ([I5]).
 *
 * - Extends `expect` with `@testing-library/jest-dom` matchers
 *   (toBeInTheDocument, toHaveAttribute, etc.).
 * - Extends `expect` with vitest-axe's `toHaveNoViolations` so
 *   a11y assertions read the same way component assertions do.
 * - Runs `cleanup()` after each test to unmount RTL trees + reset
 *   the jsdom container (matches RTL's auto-cleanup behaviour
 *   under jest; we wire it explicitly because vitest's globals
 *   don't include it).
 */
import '@testing-library/jest-dom/vitest';
import { afterEach, expect } from 'vitest';
import { cleanup } from '@testing-library/react';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — vitest-axe ships its own types but the resolution
// fails under the workspace pnpm layout; the runtime call works.
import * as matchers from 'vitest-axe/matchers';

expect.extend(matchers);

afterEach(() => {
  cleanup();
});
