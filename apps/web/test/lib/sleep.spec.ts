/**
 * Vitest specs for AE284 sleep helper.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sleep } from '../../src/lib/sleep';

describe('sleep', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves after ms', async () => {
    let done = false;
    const p = sleep(100).then(() => {
      done = true;
    });
    await vi.advanceTimersByTimeAsync(99);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await p;
    expect(done).toBe(true);
  });

  it('resolves immediately for ms=0', async () => {
    let done = false;
    const p = sleep(0).then(() => {
      done = true;
    });
    await vi.advanceTimersByTimeAsync(0);
    await p;
    expect(done).toBe(true);
  });

  it('negative ms clamped to 0', async () => {
    let done = false;
    const p = sleep(-500).then(() => {
      done = true;
    });
    await vi.advanceTimersByTimeAsync(0);
    await p;
    expect(done).toBe(true);
  });

  it('abort signal rejects the promise', async () => {
    const ctrl = new AbortController();
    let rejected = false;
    const p = sleep(1000, { signal: ctrl.signal }).catch(() => {
      rejected = true;
    });
    await vi.advanceTimersByTimeAsync(100);
    ctrl.abort();
    await p;
    expect(rejected).toBe(true);
  });

  it('pre-aborted signal rejects immediately', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    let rejected = false;
    const p = sleep(1000, { signal: ctrl.signal }).catch(() => {
      rejected = true;
    });
    await p;
    expect(rejected).toBe(true);
  });
});
