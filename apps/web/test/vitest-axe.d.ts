/**
 * Type augmentation for vitest-axe's matchers ([I5]).
 *
 * `vitest-axe` extends `expect` at runtime via `expect.extend(matchers)`
 * in test/setup.ts, but its package doesn't ship the corresponding
 * type declarations in a way vitest auto-picks-up. This file adds the
 * single matcher we use (`toHaveNoViolations`) to the vitest
 * `Assertion` interface so component specs typecheck cleanly.
 */
import 'vitest';

declare module 'vitest' {
  interface Assertion<T = unknown> {
    toHaveNoViolations(): T;
  }

  interface AsymmetricMatchersContaining {
    toHaveNoViolations(): unknown;
  }
}
