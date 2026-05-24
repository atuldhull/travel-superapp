/**
 * @app/clock — injectable Clock service ([L4]).
 *
 * Why: the review's "control time" item — the TOMORROW-hardcoded bug
 * (`const TOMORROW = new Date('2026-05-17')`) ages on its own;
 * test files calling `Date.now()` inline can't be deterministically
 * driven; production code that ages tokens / schedules background
 * jobs / computes "is this trip in the past" has no clean seam for a
 * test to roll the clock forward.
 *
 * Use:
 *   1. Production code imports `Clock` (the interface). Inject via
 *      `@Inject(CLOCK)` in Nest constructors; otherwise pass the
 *      Clock down through pure-function arguments. Never `new Date()`
 *      / `Date.now()` directly in src/.
 *   2. The Nest composition root binds `CLOCK` to `SystemClock` —
 *      the production no-op that just delegates to the host.
 *   3. Tests bind to `FakeClock` (`makeFakeClock(initial)`) and call
 *      `.advance(ms)` / `.setNow(date)` to deterministically drive
 *      time-dependent code.
 *
 * Pure JS. No NestJS / Prisma / fastify deps — works in workers, in
 * any package, in pure unit tests.
 *
 * Installed by prompt [L4].
 */

/** Single read of the current instant. Implementations promise that
 *  back-to-back `now()` calls return monotonically non-decreasing
 *  values. */
export interface Clock {
  /** Current instant. Returns a fresh Date each call. */
  now(): Date;
  /** Same instant as `now()`, in millis since epoch. Convenience
   *  for code that doesn't want a Date allocation. */
  nowMs(): number;
}

/** Production clock — delegates to the host. Singleton. */
export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
  nowMs(): number {
    return Date.now();
  }
}

/** Singleton SystemClock — most production providers just `provideValue`
 *  this, no per-request instance needed. */
export const SYSTEM_CLOCK = new SystemClock();

/** NestJS DI token for the Clock. Inject via `@Inject(CLOCK)`. The
 *  composition root binds it to SYSTEM_CLOCK; tests bind to a
 *  FakeClock instance. */
export const CLOCK = Symbol('Clock');

/** A controllable Clock for tests. Construct with `makeFakeClock(at)`;
 *  call `advance(ms)` to roll the clock forward, `setNow(date)` for
 *  absolute moves. Threadsafe-by-construction (single mutable cell). */
export interface FakeClock extends Clock {
  /** Roll the clock forward by `ms` milliseconds. */
  advance(ms: number): void;
  /** Jump to an absolute moment. */
  setNow(at: Date | number): void;
}

export function makeFakeClock(initial: Date | number = 0): FakeClock {
  let current = initial instanceof Date ? initial.getTime() : initial;
  return {
    now: (): Date => new Date(current),
    nowMs: (): number => current,
    advance: (ms: number): void => {
      current += ms;
    },
    setNow: (at: Date | number): void => {
      current = at instanceof Date ? at.getTime() : at;
    },
  };
}
