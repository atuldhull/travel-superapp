/**
 * Vitest jsdom specs for AE229 useDebouncedValue.
 */
import { act, render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDebouncedValue } from '../../src/components/aether/use-debounced-value';

function Probe({
  value,
  delayMs,
  out,
}: {
  value: string;
  delayMs: number;
  out: { current: string };
}): ReactElement {
  const d = useDebouncedValue(value, delayMs);
  out.current = d;
  return <span data-testid="probe">{d}</span>;
}

describe('useDebouncedValue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('first render returns the initial value immediately', () => {
    const out = { current: '__unset__' };
    render(<Probe value="hello" delayMs={200} out={out} />);
    expect(out.current).toBe('hello');
  });

  it('quick successive changes coalesce to the last value', () => {
    const out = { current: '__unset__' };
    const { rerender } = render(<Probe value="a" delayMs={200} out={out} />);
    expect(out.current).toBe('a');
    rerender(<Probe value="ab" delayMs={200} out={out} />);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    rerender(<Probe value="abc" delayMs={200} out={out} />);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    // 200ms has elapsed since 'ab' was set but timer was reset by 'abc'.
    expect(out.current).toBe('a');
    act(() => {
      vi.advanceTimersByTime(100);
    });
    // 200ms since 'abc' update → debounced catches up.
    expect(out.current).toBe('abc');
  });

  it('honours custom delayMs', () => {
    const out = { current: '__unset__' };
    const { rerender } = render(<Probe value="x" delayMs={500} out={out} />);
    rerender(<Probe value="y" delayMs={500} out={out} />);
    act(() => {
      vi.advanceTimersByTime(499);
    });
    expect(out.current).toBe('x');
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(out.current).toBe('y');
  });

  it('delayMs<=0 returns the latest value (no debounce)', () => {
    const out = { current: '__unset__' };
    const { rerender } = render(<Probe value="a" delayMs={0} out={out} />);
    expect(out.current).toBe('a');
    rerender(<Probe value="b" delayMs={0} out={out} />);
    // No timer, no advance — but rerender already commits via effect.
    expect(out.current).toBe('b');
  });

  it('unmount mid-window does not throw / leak setState', () => {
    const out = { current: '__unset__' };
    const { rerender, unmount } = render(<Probe value="a" delayMs={500} out={out} />);
    rerender(<Probe value="b" delayMs={500} out={out} />);
    unmount();
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    // No throw, no warning.
  });
});
