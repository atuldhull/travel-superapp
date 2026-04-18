import { DomainError, isDomainError, type DomainErrorContext } from '../src/base.error';

class TestError extends DomainError {
  readonly code = 'TEST_ERROR';
  readonly httpStatus = 418 as const;
  constructor(message = 'teapot', ctx: DomainErrorContext = {}) {
    super(message, ctx);
  }
}

describe('DomainError', () => {
  it('sets name to the concrete subclass name', () => {
    const err = new TestError();
    expect(err.name).toBe('TestError');
  });

  it('preserves `instanceof DomainError` and `instanceof <subclass>`', () => {
    const err = new TestError();
    expect(err).toBeInstanceOf(DomainError);
    expect(err).toBeInstanceOf(TestError);
    expect(err).toBeInstanceOf(Error);
  });

  it('freezes the context so callers cannot mutate after construction', () => {
    const input = { tripId: 'trip_1' };
    const err = new TestError('x', input);
    expect(Object.isFrozen(err.context)).toBe(true);
    expect(err.context).toEqual({ tripId: 'trip_1' });
    // Mutating the ORIGINAL input must not leak into the error.
    (input as Record<string, unknown>).tripId = 'trip_2';
    expect(err.context['tripId']).toBe('trip_1');
  });

  it('sets a UTC Date timestamp at construction time', () => {
    const before = Date.now();
    const err = new TestError();
    const after = Date.now();
    expect(err.timestamp).toBeInstanceOf(Date);
    expect(err.timestamp.getTime()).toBeGreaterThanOrEqual(before);
    expect(err.timestamp.getTime()).toBeLessThanOrEqual(after);
  });

  it('toJSON emits code, message, context, timestamp — no stack', () => {
    const err = new TestError('boom', { foo: 'bar' });
    const json = err.toJSON();
    expect(json).toEqual({
      code: 'TEST_ERROR',
      message: 'boom',
      context: { foo: 'bar' },
      timestamp: err.timestamp.toISOString(),
    });
    expect((json as unknown as { stack?: unknown }).stack).toBeUndefined();
  });

  it('captures a stack trace that does not include DomainError constructor frames', () => {
    const err = new TestError();
    expect(err.stack).toBeDefined();
    // Our capture target is `new.target` (the subclass), so the stack should
    // start inside the test, not inside DomainError itself.
    expect(err.stack!.split('\n')[0]).toContain('TestError');
  });

  it('isDomainError narrows unknown values correctly', () => {
    expect(isDomainError(new TestError())).toBe(true);
    expect(isDomainError(new Error('plain'))).toBe(false);
    expect(isDomainError({ code: 'TEST', message: 'x' })).toBe(false);
    expect(isDomainError(null)).toBe(false);
    expect(isDomainError(undefined)).toBe(false);
    expect(isDomainError('TEST_ERROR')).toBe(false);
  });
});
