/**
 * Vitest specs for AE347 useTransientFlag.
 */
// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTransientFlag } from '../../src/components/aether/use-transient-flag';

describe('useTransientFlag', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('starts false', () => {
    const { result } = renderHook(() => useTransientFlag(2000));
    expect(result.current[0]).toBe(false);
  });

  it('trigger() flips to true', () => {
    const { result } = renderHook(() => useTransientFlag(2000));
    act(() => result.current[1]());
    expect(result.current[0]).toBe(true);
  });

  it('auto-disarms after the duration', () => {
    const { result } = renderHook(() => useTransientFlag(2000));
    act(() => result.current[1]());
    act(() => vi.advanceTimersByTime(2000));
    expect(result.current[0]).toBe(false);
  });

  it('still armed just before the cutoff', () => {
    const { result } = renderHook(() => useTransientFlag(2000));
    act(() => result.current[1]());
    act(() => vi.advanceTimersByTime(1999));
    expect(result.current[0]).toBe(true);
  });

  it('re-trigger restarts the window (extends the chip)', () => {
    const { result } = renderHook(() => useTransientFlag(2000));
    act(() => result.current[1]());
    act(() => vi.advanceTimersByTime(1000));
    act(() => result.current[1]());
    act(() => vi.advanceTimersByTime(1999));
    expect(result.current[0]).toBe(true);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current[0]).toBe(false);
  });

  it('custom duration honoured (500ms)', () => {
    const { result } = renderHook(() => useTransientFlag(500));
    act(() => result.current[1]());
    act(() => vi.advanceTimersByTime(500));
    expect(result.current[0]).toBe(false);
  });

  it('unmount clears timer (no late setState)', () => {
    const { result, unmount } = renderHook(() => useTransientFlag(2000));
    act(() => result.current[1]());
    unmount();
    expect(() => vi.advanceTimersByTime(3000)).not.toThrow();
  });

  it('returns a stable trigger function (no re-render churn)', () => {
    const { result, rerender } = renderHook(() => useTransientFlag(2000));
    const first = result.current[1];
    rerender();
    expect(result.current[1]).toBe(first);
  });
});
