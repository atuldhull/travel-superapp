import {
  extendTraceContext,
  generateSpanId,
  generateTraceId,
  getTraceContext,
  runWithTraceContext,
} from '../src/trace-context';

describe('trace-context', () => {
  describe('getTraceContext', () => {
    it('returns undefined outside any run scope', () => {
      expect(getTraceContext()).toBeUndefined();
    });
  });

  describe('runWithTraceContext', () => {
    it('exposes the supplied context inside the callback', () => {
      let seen: unknown;
      runWithTraceContext({ traceId: 't-1', userId: 'u-1' }, () => {
        seen = getTraceContext();
      });
      expect(seen).toMatchObject({ traceId: 't-1', userId: 'u-1' });
    });

    it('isolates sibling runs from each other', () => {
      const seen: string[] = [];
      runWithTraceContext({ traceId: 'a' }, () => seen.push(getTraceContext()?.traceId ?? 'none'));
      runWithTraceContext({ traceId: 'b' }, () => seen.push(getTraceContext()?.traceId ?? 'none'));
      expect(seen).toEqual(['a', 'b']);
    });

    it('nests inner scope over outer and restores on exit', () => {
      const seen: string[] = [];
      runWithTraceContext({ traceId: 'outer' }, () => {
        seen.push(getTraceContext()!.traceId);
        runWithTraceContext({ traceId: 'inner' }, () => {
          seen.push(getTraceContext()!.traceId);
        });
        seen.push(getTraceContext()!.traceId);
      });
      expect(seen).toEqual(['outer', 'inner', 'outer']);
    });

    it('propagates across awaited async boundaries', async () => {
      const captured = await runWithTraceContext({ traceId: 'async-1' }, async () => {
        await new Promise((r) => setTimeout(r, 5));
        return getTraceContext()?.traceId;
      });
      expect(captured).toBe('async-1');
    });

    it('returns the callback result', () => {
      const result = runWithTraceContext({ traceId: 'x' }, () => 42);
      expect(result).toBe(42);
    });

    it('restores outer context after an inner throw', () => {
      let afterThrow: string | undefined;
      runWithTraceContext({ traceId: 'outer' }, () => {
        expect(() =>
          runWithTraceContext({ traceId: 'inner' }, () => {
            throw new Error('boom');
          }),
        ).toThrow('boom');
        afterThrow = getTraceContext()?.traceId;
      });
      expect(afterThrow).toBe('outer');
    });
  });

  describe('extendTraceContext', () => {
    it('mints a new traceId when called with no outer scope', () => {
      let ctx: unknown;
      extendTraceContext({ userId: 'u-1' }, () => {
        ctx = getTraceContext();
      });
      expect(ctx).toMatchObject({ userId: 'u-1' });
      expect((ctx as { traceId: string }).traceId).toMatch(/^[0-9a-f]{32}$/);
    });

    it('preserves the outer traceId and merges patch fields', () => {
      runWithTraceContext({ traceId: 'outer' }, () => {
        extendTraceContext({ userId: 'u-42' }, () => {
          const c = getTraceContext()!;
          expect(c.traceId).toBe('outer');
          expect(c.userId).toBe('u-42');
        });
      });
    });

    it('merges tags from outer + patch', () => {
      runWithTraceContext({ traceId: 't', tags: { a: '1', b: '2' } }, () => {
        extendTraceContext({ tags: { b: 'override', c: '3' } }, () => {
          expect(getTraceContext()!.tags).toEqual({ a: '1', b: 'override', c: '3' });
        });
      });
    });
  });

  describe('generateTraceId', () => {
    it('returns 32 lowercase hex chars', () => {
      const id = generateTraceId();
      expect(id).toMatch(/^[0-9a-f]{32}$/);
    });

    it('returns different values on repeated calls', () => {
      const a = generateTraceId();
      const b = generateTraceId();
      expect(a).not.toBe(b);
    });
  });

  describe('generateSpanId', () => {
    it('returns 16 lowercase hex chars', () => {
      expect(generateSpanId()).toMatch(/^[0-9a-f]{16}$/);
    });
  });
});
