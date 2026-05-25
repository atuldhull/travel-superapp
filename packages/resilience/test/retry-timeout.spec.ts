/**
 * Tests for `withRetry` + `withTimeout` ([N8]).
 */
import { withRetry, withTimeout, TimeoutError } from '../src/index';

describe('withRetry', () => {
  it('returns the first success', async () => {
    let calls = 0;
    const result = await withRetry(async () => {
      calls++;
      return 'ok';
    });
    expect(result).toBe('ok');
    expect(calls).toBe(1);
  });

  it('retries up to `attempts` then throws the last error', async () => {
    let calls = 0;
    await expect(
      withRetry(
        async () => {
          calls++;
          throw new Error(`fail-${calls}`);
        },
        { attempts: 3, baseDelayMs: 0, jitter: 0, random: () => 0.5 },
      ),
    ).rejects.toThrow('fail-3');
    expect(calls).toBe(3);
  });

  it('succeeds on a retry if the inner call recovers', async () => {
    let calls = 0;
    const result = await withRetry(
      async () => {
        calls++;
        if (calls < 3) throw new Error('try-again');
        return 'finally';
      },
      { attempts: 5, baseDelayMs: 0, jitter: 0 },
    );
    expect(result).toBe('finally');
    expect(calls).toBe(3);
  });

  it('shouldRetry=false aborts the loop immediately', async () => {
    let calls = 0;
    await expect(
      withRetry(
        async () => {
          calls++;
          throw new Error('4xx bad request');
        },
        {
          attempts: 5,
          baseDelayMs: 0,
          shouldRetry: (e) => !(e instanceof Error) || !e.message.startsWith('4xx'),
        },
      ),
    ).rejects.toThrow('4xx bad request');
    expect(calls).toBe(1);
  });

  it('applies exponential backoff with deterministic jitter', async () => {
    // We can't deterministically assert the exact delay without
    // mocking setTimeout. Instead assert the COUNT of attempts +
    // that the function executes in finite time when delays are
    // small.
    let calls = 0;
    const started = Date.now();
    await expect(
      withRetry(
        async () => {
          calls++;
          throw new Error('boom');
        },
        { attempts: 4, baseDelayMs: 10, factor: 2, jitter: 0, random: () => 0.5 },
      ),
    ).rejects.toThrow();
    const elapsed = Date.now() - started;
    expect(calls).toBe(4);
    // baseDelayMs * (1 + 2 + 4) = 70ms minimum; allow generous slack
    // for CI scheduling.
    expect(elapsed).toBeGreaterThanOrEqual(60);
    expect(elapsed).toBeLessThan(2000);
  });
});

describe('withTimeout', () => {
  it('resolves with the original value when the promise settles in time', async () => {
    const result = await withTimeout(Promise.resolve('hi'), 50, 'fast');
    expect(result).toBe('hi');
  });

  it('rejects TimeoutError when the promise exceeds ms', async () => {
    const slow = new Promise<string>((resolve) => {
      const t = setTimeout(() => resolve('eventually'), 100);
      t.unref?.();
    });
    await expect(withTimeout(slow, 20, 'slow-op')).rejects.toBeInstanceOf(TimeoutError);
  });

  it('propagates the inner rejection if it fails before the timeout', async () => {
    await expect(withTimeout(Promise.reject(new Error('inner')), 50, 'op')).rejects.toThrow(
      'inner',
    );
  });
});
