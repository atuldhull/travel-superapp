/**
 * Unit tests for `CircuitBreaker` ([N8]).
 *
 * Pure — uses `makeFakeClock` to drive every state transition
 * deterministically. No real setTimeout, no sleep, no flakes.
 */
import { makeFakeClock } from '@app/clock';
import { CircuitBreaker, CircuitOpenError, type CircuitState } from '../src/index';

const ok = (v: string) => () => Promise.resolve(v);
const fail = (msg: string) => () => Promise.reject(new Error(msg));

describe('CircuitBreaker', () => {
  it('starts CLOSED and stays CLOSED on success', async () => {
    const clock = makeFakeClock(0);
    const cb = new CircuitBreaker({ name: 'test', clock });
    await expect(cb.exec(ok('hi'))).resolves.toBe('hi');
    expect(cb.getState()).toBe('closed');
    expect(cb.getConsecutiveFailures()).toBe(0);
  });

  it('opens after `failureThreshold` consecutive failures', async () => {
    const clock = makeFakeClock(0);
    const cb = new CircuitBreaker({ name: 't', clock, failureThreshold: 3 });
    await expect(cb.exec(fail('boom-1'))).rejects.toThrow('boom-1');
    await expect(cb.exec(fail('boom-2'))).rejects.toThrow('boom-2');
    expect(cb.getState()).toBe('closed'); // still closed at threshold-1
    await expect(cb.exec(fail('boom-3'))).rejects.toThrow('boom-3');
    expect(cb.getState()).toBe('open');
  });

  it('fast-fails CircuitOpenError when OPEN', async () => {
    const clock = makeFakeClock(0);
    const cb = new CircuitBreaker({ name: 't', clock, failureThreshold: 1 });
    await expect(cb.exec(fail('boom'))).rejects.toThrow('boom');
    expect(cb.getState()).toBe('open');
    await expect(cb.exec(ok('would-succeed'))).rejects.toBeInstanceOf(CircuitOpenError);
  });

  it('transitions OPEN → HALF-OPEN after openMs elapses', async () => {
    const clock = makeFakeClock(0);
    const cb = new CircuitBreaker({
      name: 't',
      clock,
      failureThreshold: 1,
      openMs: 1000,
    });
    await expect(cb.exec(fail('boom'))).rejects.toThrow('boom');
    expect(cb.getState()).toBe('open');
    clock.advance(999);
    expect(cb.getState()).toBe('open'); // not yet
    clock.advance(1);
    expect(cb.getState()).toBe('half-open');
  });

  it('HALF-OPEN → CLOSED on successful probe', async () => {
    const clock = makeFakeClock(0);
    const cb = new CircuitBreaker({
      name: 't',
      clock,
      failureThreshold: 1,
      openMs: 100,
    });
    await expect(cb.exec(fail('boom'))).rejects.toThrow('boom');
    clock.advance(101);
    await expect(cb.exec(ok('healed'))).resolves.toBe('healed');
    expect(cb.getState()).toBe('closed');
    expect(cb.getConsecutiveFailures()).toBe(0);
  });

  it('HALF-OPEN → OPEN on failed probe (and stays open another openMs)', async () => {
    const clock = makeFakeClock(0);
    const cb = new CircuitBreaker({
      name: 't',
      clock,
      failureThreshold: 1,
      openMs: 100,
    });
    await expect(cb.exec(fail('first'))).rejects.toThrow('first');
    clock.advance(101);
    expect(cb.getState()).toBe('half-open');
    await expect(cb.exec(fail('probe-fail'))).rejects.toThrow('probe-fail');
    expect(cb.getState()).toBe('open');
    // Need ANOTHER full openMs before next probe.
    clock.advance(99);
    expect(cb.getState()).toBe('open');
    clock.advance(1);
    expect(cb.getState()).toBe('half-open');
  });

  it('isFailure() can exempt non-fault errors', async () => {
    const clock = makeFakeClock(0);
    const is4xx = (e: unknown): boolean => {
      // Don't count caller-bug errors toward the failure streak.
      const msg = e instanceof Error ? e.message : '';
      return !msg.startsWith('4');
    };
    const cb = new CircuitBreaker({
      name: 't',
      clock,
      failureThreshold: 2,
      isFailure: is4xx,
    });
    // 10 caller-bugs should NOT open the circuit.
    for (let i = 0; i < 10; i++) {
      await expect(cb.exec(fail('400 bad input'))).rejects.toThrow();
    }
    expect(cb.getState()).toBe('closed');
    // But a real failure DOES count.
    await expect(cb.exec(fail('500 upstream'))).rejects.toThrow();
    await expect(cb.exec(fail('500 upstream'))).rejects.toThrow();
    expect(cb.getState()).toBe('open');
  });

  it('onTransition fires on every state change with from/to/name', async () => {
    const clock = makeFakeClock(0);
    const transitions: Array<[CircuitState, CircuitState, string]> = [];
    const cb = new CircuitBreaker({
      name: 'weather',
      clock,
      failureThreshold: 1,
      openMs: 100,
      onTransition: (from, to, name) => transitions.push([from, to, name]),
    });
    await expect(cb.exec(fail('boom'))).rejects.toThrow('boom');
    clock.advance(101);
    await expect(cb.exec(ok('healed'))).resolves.toBe('healed');
    expect(transitions).toEqual([
      ['closed', 'open', 'weather'],
      ['open', 'half-open', 'weather'],
      ['half-open', 'closed', 'weather'],
    ]);
  });

  it('success in CLOSED resets the failure streak', async () => {
    const clock = makeFakeClock(0);
    const cb = new CircuitBreaker({ name: 't', clock, failureThreshold: 3 });
    await expect(cb.exec(fail('a'))).rejects.toThrow();
    await expect(cb.exec(fail('b'))).rejects.toThrow();
    expect(cb.getConsecutiveFailures()).toBe(2);
    await expect(cb.exec(ok('recovery'))).resolves.toBe('recovery');
    expect(cb.getConsecutiveFailures()).toBe(0);
    // Two more failures should NOT open (we're now back to 2, not 4).
    await expect(cb.exec(fail('c'))).rejects.toThrow();
    await expect(cb.exec(fail('d'))).rejects.toThrow();
    expect(cb.getState()).toBe('closed');
    await expect(cb.exec(fail('e'))).rejects.toThrow();
    expect(cb.getState()).toBe('open');
  });
});
