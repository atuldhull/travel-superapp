/** Vitest specs for AE420 `useEchoSwipe()` hook. */
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  ECHO_WHEEL_THROTTLE_MS,
  useEchoSwipe,
} from '../../src/components/aether/phase3/use-echo-swipe';

const ITEMS = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

describe('useEchoSwipe — pointer swipe (jsdom)', () => {
  it('vertical-down swipe past noise advances to next', () => {
    const setActiveIndex = vi.fn();
    const { result } = renderHook(() =>
      useEchoSwipe({ items: ITEMS, activeIndex: 0, setActiveIndex }),
    );
    act(() => {
      result.current.onPointerDown({
        clientX: 100,
        clientY: 100,
      } as React.PointerEvent<HTMLElement>);
      result.current.onPointerUp({ clientX: 100, clientY: 300 } as React.PointerEvent<HTMLElement>);
    });
    expect(setActiveIndex).toHaveBeenCalledWith(1);
  });

  it('horizontal-left swipe past noise rewinds (swipe up is save-place)', () => {
    const setActiveIndex = vi.fn();
    const onAction = vi.fn();
    const { result } = renderHook(() =>
      useEchoSwipe({ items: ITEMS, activeIndex: 2, setActiveIndex, onAction }),
    );
    act(() => {
      result.current.onPointerDown({
        clientX: 300,
        clientY: 100,
      } as React.PointerEvent<HTMLElement>);
      result.current.onPointerUp({ clientX: 100, clientY: 100 } as React.PointerEvent<HTMLElement>);
    });
    expect(setActiveIndex).toHaveBeenCalledWith(1);
    expect(onAction).toHaveBeenCalledWith('prev');
  });

  it('vertical-up swipe past noise fires save-place (per 02-surfaces.md §6)', () => {
    const setActiveIndex = vi.fn();
    const onAction = vi.fn();
    const { result } = renderHook(() =>
      useEchoSwipe({ items: ITEMS, activeIndex: 1, setActiveIndex, onAction }),
    );
    act(() => {
      result.current.onPointerDown({
        clientX: 100,
        clientY: 300,
      } as React.PointerEvent<HTMLElement>);
      result.current.onPointerUp({ clientX: 100, clientY: 100 } as React.PointerEvent<HTMLElement>);
    });
    expect(setActiveIndex).not.toHaveBeenCalled();
    expect(onAction).toHaveBeenCalledWith('save-place');
  });

  it('horizontal-right swipe fires the follow action without moving cursor', () => {
    const setActiveIndex = vi.fn();
    const onAction = vi.fn();
    const { result } = renderHook(() =>
      useEchoSwipe({ items: ITEMS, activeIndex: 1, setActiveIndex, onAction }),
    );
    act(() => {
      result.current.onPointerDown({
        clientX: 100,
        clientY: 100,
      } as React.PointerEvent<HTMLElement>);
      result.current.onPointerUp({ clientX: 300, clientY: 100 } as React.PointerEvent<HTMLElement>);
    });
    expect(setActiveIndex).not.toHaveBeenCalled();
    expect(onAction).toHaveBeenCalledWith('follow-traveller');
  });

  it('sub-threshold movement is ignored', () => {
    const setActiveIndex = vi.fn();
    const onAction = vi.fn();
    const { result } = renderHook(() =>
      useEchoSwipe({ items: ITEMS, activeIndex: 1, setActiveIndex, onAction }),
    );
    act(() => {
      result.current.onPointerDown({
        clientX: 100,
        clientY: 100,
      } as React.PointerEvent<HTMLElement>);
      result.current.onPointerUp({ clientX: 110, clientY: 108 } as React.PointerEvent<HTMLElement>);
    });
    expect(setActiveIndex).not.toHaveBeenCalled();
    expect(onAction).not.toHaveBeenCalled();
  });

  it('pointerCancel clears the start so a stray pointerUp does nothing', () => {
    const setActiveIndex = vi.fn();
    const { result } = renderHook(() =>
      useEchoSwipe({ items: ITEMS, activeIndex: 0, setActiveIndex }),
    );
    act(() => {
      result.current.onPointerDown({
        clientX: 100,
        clientY: 100,
      } as React.PointerEvent<HTMLElement>);
      result.current.onPointerCancel();
      result.current.onPointerUp({ clientX: 100, clientY: 400 } as React.PointerEvent<HTMLElement>);
    });
    expect(setActiveIndex).not.toHaveBeenCalled();
  });
});

describe('useEchoSwipe — wheel', () => {
  it('positive deltaY past noise advances; sub-noise no-ops', () => {
    const setActiveIndex = vi.fn();
    const { result } = renderHook(() =>
      useEchoSwipe({ items: ITEMS, activeIndex: 0, setActiveIndex }),
    );
    act(() => {
      result.current.onWheel({ deltaY: 200 } as React.WheelEvent<HTMLElement>);
    });
    expect(setActiveIndex).toHaveBeenCalledWith(1);
    act(() => {
      result.current.onWheel({ deltaY: 4 } as React.WheelEvent<HTMLElement>);
    });
    expect(setActiveIndex).toHaveBeenCalledTimes(1);
  });

  it('negative deltaY rewinds', () => {
    const setActiveIndex = vi.fn();
    const { result } = renderHook(() =>
      useEchoSwipe({ items: ITEMS, activeIndex: 2, setActiveIndex }),
    );
    act(() => {
      result.current.onWheel({ deltaY: -200 } as React.WheelEvent<HTMLElement>);
    });
    expect(setActiveIndex).toHaveBeenCalledWith(1);
  });

  it('throttles consecutive wheel events', () => {
    const setActiveIndex = vi.fn();
    const { result } = renderHook(() =>
      useEchoSwipe({ items: ITEMS, activeIndex: 0, setActiveIndex }),
    );
    act(() => {
      result.current.onWheel({ deltaY: 200 } as React.WheelEvent<HTMLElement>);
      result.current.onWheel({ deltaY: 200 } as React.WheelEvent<HTMLElement>);
      result.current.onWheel({ deltaY: 200 } as React.WheelEvent<HTMLElement>);
    });
    // The throttle (220 ms) should allow at most one within the burst.
    expect(setActiveIndex).toHaveBeenCalledTimes(1);
  });

  it('throttle constant is reasonable (≥ 100ms ≤ 1s)', () => {
    expect(ECHO_WHEEL_THROTTLE_MS).toBeGreaterThanOrEqual(100);
    expect(ECHO_WHEEL_THROTTLE_MS).toBeLessThanOrEqual(1_000);
  });
});

describe('useEchoSwipe — keyboard', () => {
  function ev(key: string): React.KeyboardEvent<HTMLElement> {
    return {
      key,
      preventDefault: () => undefined,
    } as unknown as React.KeyboardEvent<HTMLElement>;
  }
  it('ArrowDown + j advance', () => {
    const setActiveIndex = vi.fn();
    const { result } = renderHook(() =>
      useEchoSwipe({ items: ITEMS, activeIndex: 0, setActiveIndex }),
    );
    act(() => {
      result.current.onKeyDown(ev('ArrowDown'));
    });
    expect(setActiveIndex).toHaveBeenLastCalledWith(1);
    act(() => {
      result.current.onKeyDown(ev('j'));
    });
    expect(setActiveIndex).toHaveBeenCalledTimes(2);
  });
  it('ArrowUp + k rewind', () => {
    const setActiveIndex = vi.fn();
    const { result } = renderHook(() =>
      useEchoSwipe({ items: ITEMS, activeIndex: 2, setActiveIndex }),
    );
    act(() => {
      result.current.onKeyDown(ev('ArrowUp'));
    });
    expect(setActiveIndex).toHaveBeenLastCalledWith(1);
    act(() => {
      result.current.onKeyDown(ev('k'));
    });
    expect(setActiveIndex).toHaveBeenCalledTimes(2);
  });
  it('s / f / p fire actions without moving the cursor', () => {
    const setActiveIndex = vi.fn();
    const onAction = vi.fn();
    const { result } = renderHook(() =>
      useEchoSwipe({ items: ITEMS, activeIndex: 1, setActiveIndex, onAction }),
    );
    act(() => {
      result.current.onKeyDown(ev('s'));
      result.current.onKeyDown(ev('f'));
      result.current.onKeyDown(ev('p'));
    });
    expect(setActiveIndex).not.toHaveBeenCalled();
    expect(onAction).toHaveBeenNthCalledWith(1, 'save-place');
    expect(onAction).toHaveBeenNthCalledWith(2, 'follow-traveller');
    expect(onAction).toHaveBeenNthCalledWith(3, 'plan-like-this');
  });
  it('uppercase variants work too', () => {
    const setActiveIndex = vi.fn();
    const onAction = vi.fn();
    const { result } = renderHook(() =>
      useEchoSwipe({ items: ITEMS, activeIndex: 0, setActiveIndex, onAction }),
    );
    act(() => {
      result.current.onKeyDown(ev('S'));
    });
    expect(onAction).toHaveBeenCalledWith('save-place');
  });
  it('unknown keys are ignored', () => {
    const setActiveIndex = vi.fn();
    const onAction = vi.fn();
    const { result } = renderHook(() =>
      useEchoSwipe({ items: ITEMS, activeIndex: 0, setActiveIndex, onAction }),
    );
    act(() => {
      result.current.onKeyDown(ev('Tab'));
      result.current.onKeyDown(ev('Enter'));
    });
    expect(setActiveIndex).not.toHaveBeenCalled();
    expect(onAction).not.toHaveBeenCalled();
  });
});
