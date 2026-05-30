/**
 * AE284 — Promise-based delay helper.
 *
 * Used by:
 *   - AE146 `{submit:true}` auto-send (220ms before firing ask())
 *   - retry-with-backoff paths in future fetch wrappers
 *   - storybook "wait for hover" interactions
 *
 * Honest contract: resolves with no value after `ms` milliseconds.
 * Accepts an optional AbortSignal so callers can cancel the wait
 * — the returned promise rejects with the abort reason if so.
 */

export interface SleepOptions {
  readonly signal?: AbortSignal;
}

export function sleep(ms: number, opts: SleepOptions = {}): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const signal = opts.signal;
    if (signal?.aborted === true) {
      reject(signal.reason);
      return;
    }
    const timer = setTimeout(
      () => {
        if (signal !== undefined) signal.removeEventListener('abort', onAbort);
        resolve();
      },
      Math.max(0, ms),
    );
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(signal?.reason);
    };
    if (signal !== undefined) {
      signal.addEventListener('abort', onAbort, { once: true });
    }
  });
}
