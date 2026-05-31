/**
 * Vitest specs for AE351 useTransientValue.
 */
// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTransientValue } from '../../src/components/aether/use-transient-value';

describe('useTransientValue', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('starts null', () => {
    const { result } = renderHook(() => useTransientValue<string>(2000));
    expect(result.current[0]).toBeNull();
  });

  it('set(v) returns v immediately, then null after the window', () => {
    const { result } = renderHook(() => useTransientValue<string>(2000));
    act(() => result.current[1]('abc123'));
    expect(result.current[0]).toBe('abc123');
    act(() => vi.advanceTimersByTime(2000));
    expect(result.current[0]).toBeNull();
  });

  it('set replaces the prior value + restarts the window', () => {
    const { result } = renderHook(() => useTransientValue<string>(2000));
    act(() => result.current[1]('first'));
    act(() => vi.advanceTimersByTime(1000));
    act(() => result.current[1]('second'));
    expect(result.current[0]).toBe('second');
    // 1999ms after the 'second' call, still armed:
    act(() => vi.advanceTimersByTime(1999));
    expect(result.current[0]).toBe('second');
    act(() => vi.advanceTimersByTime(1));
    expect(result.current[0]).toBeNull();
  });

  it('works with numeric values', () => {
    const { result } = renderHook(() => useTransientValue<number>(500));
    act(() => result.current[1](42));
    expect(result.current[0]).toBe(42);
  });

  it('returned setter is stable across re-renders', () => {
    const { result, rerender } = renderHook(() => useTransientValue<string>(2000));
    const first = result.current[1];
    rerender();
    expect(result.current[1]).toBe(first);
  });

  it('unmount clears timer (no late setState warnings)', () => {
    const { result, unmount } = renderHook(() => useTransientValue<string>(2000));
    act(() => result.current[1]('x'));
    unmount();
    expect(() => vi.advanceTimersByTime(3000)).not.toThrow();
  });
});
