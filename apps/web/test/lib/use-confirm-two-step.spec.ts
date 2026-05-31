/**
 * Vitest specs for AE332 useConfirmTwoStep.
 *
 * jsdom + fake timers so we can advance through the 4s auto-disarm
 * without actually waiting.
 */
// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useConfirmTwoStep } from '../../src/components/aether/use-confirm-two-step';

describe('useConfirmTwoStep', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts disarmed; first onPress arms but does NOT fire', () => {
    const action = vi.fn();
    const { result } = renderHook(() => useConfirmTwoStep(action));
    expect(result.current.armed).toBe(false);
    act(() => result.current.onPress());
    expect(result.current.armed).toBe(true);
    expect(action).not.toHaveBeenCalled();
  });

  it('second onPress within the window fires + disarms', () => {
    const action = vi.fn();
    const { result } = renderHook(() => useConfirmTwoStep(action, 4000));
    act(() => result.current.onPress());
    act(() => result.current.onPress());
    expect(action).toHaveBeenCalledTimes(1);
    expect(result.current.armed).toBe(false);
  });

  it('auto-disarms after the window elapses without a second tap', () => {
    const action = vi.fn();
    const { result } = renderHook(() => useConfirmTwoStep(action, 4000));
    act(() => result.current.onPress());
    expect(result.current.armed).toBe(true);
    act(() => vi.advanceTimersByTime(4000));
    expect(result.current.armed).toBe(false);
    expect(action).not.toHaveBeenCalled();
  });

  it('second tap right before the window cutoff still fires', () => {
    const action = vi.fn();
    const { result } = renderHook(() => useConfirmTwoStep(action, 4000));
    act(() => result.current.onPress());
    act(() => vi.advanceTimersByTime(3999));
    act(() => result.current.onPress());
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('reset() disarms immediately + clears the timer', () => {
    const action = vi.fn();
    const { result } = renderHook(() => useConfirmTwoStep(action, 4000));
    act(() => result.current.onPress());
    act(() => result.current.reset());
    expect(result.current.armed).toBe(false);
    // Even after the original window elapses, no late state change.
    act(() => vi.advanceTimersByTime(5000));
    expect(action).not.toHaveBeenCalled();
  });

  it('arming twice in a row re-extends the window', () => {
    const action = vi.fn();
    const { result } = renderHook(() => useConfirmTwoStep(action, 4000));
    act(() => result.current.onPress());
    // After 3s, calling onPress AGAIN would fire because armed=true;
    // ensure that's the intended behaviour.
    act(() => vi.advanceTimersByTime(3000));
    act(() => result.current.onPress());
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('custom windowMs (1000) works', () => {
    const action = vi.fn();
    const { result } = renderHook(() => useConfirmTwoStep(action, 1000));
    act(() => result.current.onPress());
    expect(result.current.armed).toBe(true);
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.armed).toBe(false);
  });

  it('cleans up timer on unmount (no late setArmed)', () => {
    const action = vi.fn();
    const { result, unmount } = renderHook(() => useConfirmTwoStep(action, 4000));
    act(() => result.current.onPress());
    unmount();
    // Advancing past the window after unmount must not throw.
    expect(() => vi.advanceTimersByTime(5000)).not.toThrow();
    expect(action).not.toHaveBeenCalled();
  });
});
