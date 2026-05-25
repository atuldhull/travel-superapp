/**
 * Tests for `callExternal()` ([O1]) — the per-call wrapper that
 * combines a breaker + an optional timeout + an optional
 * CircuitOpenError mapper in one helper.
 */
import { makeFakeClock } from '@app/clock';
import { CircuitBreaker, CircuitOpenError, TimeoutError, callExternal } from '../src/index';

describe('callExternal', () => {
  it('returns the fn result on success', async () => {
    const clock = makeFakeClock(0);
    const breaker = new CircuitBreaker({ name: 't', clock });
    const result = await callExternal(async () => 'ok', { breaker, label: 'fn' });
    expect(result).toBe('ok');
  });

  it('honors the timeout', async () => {
    const clock = makeFakeClock(0);
    const breaker = new CircuitBreaker({ name: 't', clock });
    const slow = new Promise<string>((resolve) => {
      const t = setTimeout(() => resolve('eventually'), 100);
      t.unref?.();
    });
    await expect(
      callExternal(() => slow, { breaker, timeoutMs: 20, label: 'slow' }),
    ).rejects.toBeInstanceOf(TimeoutError);
  });

  it('opens the breaker on the threshold-th failure', async () => {
    const clock = makeFakeClock(0);
    const breaker = new CircuitBreaker({ name: 't', clock, failureThreshold: 2 });
    const fail = () => Promise.reject(new Error('boom'));
    await expect(callExternal(fail, { breaker, label: 'a' })).rejects.toThrow();
    await expect(callExternal(fail, { breaker, label: 'b' })).rejects.toThrow();
    expect(breaker.getState()).toBe('open');
  });

  it('routes CircuitOpenError through onCircuitOpen mapper', async () => {
    const clock = makeFakeClock(0);
    const breaker = new CircuitBreaker({ name: 't', clock, failureThreshold: 1 });
    await expect(
      callExternal(() => Promise.reject(new Error('boom')), {
        breaker,
        label: 'first',
      }),
    ).rejects.toThrow('boom');
    expect(breaker.getState()).toBe('open');

    class DomainErr extends Error {
      constructor(reason: string) {
        super(`domain:${reason}`);
        this.name = 'DomainErr';
      }
    }
    await expect(
      callExternal(() => Promise.resolve('would-succeed'), {
        breaker,
        label: 'second',
        onCircuitOpen: (err: CircuitOpenError) => {
          throw new DomainErr(err.circuitName);
        },
      }),
    ).rejects.toBeInstanceOf(DomainErr);
  });

  it('lets non-circuit-open errors pass through the mapper untouched', async () => {
    const clock = makeFakeClock(0);
    const breaker = new CircuitBreaker({ name: 't', clock });
    await expect(
      callExternal(() => Promise.reject(new Error('plain')), {
        breaker,
        label: 'p',
        onCircuitOpen: () => {
          throw new Error('mapper-should-not-fire');
        },
      }),
    ).rejects.toThrow('plain');
  });
});
