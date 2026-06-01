'use client';

/**
 * AE420 — `useEchoSwipe()` hook.
 *
 * Wires pointer / wheel / keyboard input to the AE418 echo-feed pure
 * helpers. The hook owns no DOM — it returns event handlers + a tiny
 * status flag the caller can mount on whatever element should drive
 * the feed.
 *
 * Pointer: pointerDown records (x, y, t); pointerUp computes the
 * delta, runs it through `echoSwipeDirectionFromDelta`, picks the
 * action via `echoActionForSwipe`, and either advances the cursor
 * (next/prev) or fires `onSave` / `onFollow` / `onPlan`.
 *
 * Wheel: desktop scroll. Each wheel event past the noise threshold
 * advances or rewinds by 1 (with a short throttle so a single big
 * fling doesn't blow past 5 echoes).
 *
 * Keyboard: ArrowDown / ArrowUp / j / k / s (save) / f (follow) /
 * p (plan).
 */
import { useCallback, useRef } from 'react';
import {
  ECHO_SWIPE_NOISE_PX,
  echoActionForSwipe,
  echoSwipeDirectionFromDelta,
  nextEchoIndex,
  type EchoAction,
} from './echo-feed';

export interface UseEchoSwipeOptions {
  readonly items: ReadonlyArray<{ id: string }>;
  readonly activeIndex: number;
  setActiveIndex(i: number): void;
  onAction?(action: EchoAction): void;
}

/** Cool-down between wheel-driven index moves so a fast scroll doesn't
 *  walk multiple echoes in one frame. 220 ms ~ 4.5 echoes / second cap. */
export const ECHO_WHEEL_THROTTLE_MS = 220;

export function useEchoSwipe(opts: UseEchoSwipeOptions): {
  onPointerDown: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerCancel: () => void;
  onWheel: (e: React.WheelEvent<HTMLElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => void;
} {
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const lastWheelAtRef = useRef<number>(0);

  const applyAction = useCallback(
    (action: EchoAction | null) => {
      if (action === null) return;
      if (action === 'next' || action === 'prev') {
        const next = nextEchoIndex(opts.activeIndex, opts.items.length, action);
        if (next !== opts.activeIndex) opts.setActiveIndex(next);
      }
      opts.onAction?.(action);
    },
    [opts],
  );

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLElement>): void => {
    startRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLElement>): void => {
      const start = startRef.current;
      startRef.current = null;
      if (start === null) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      const dir = echoSwipeDirectionFromDelta(dx, dy);
      applyAction(echoActionForSwipe(dir));
    },
    [applyAction],
  );

  const onPointerCancel = useCallback((): void => {
    startRef.current = null;
  }, []);

  const onWheel = useCallback(
    (e: React.WheelEvent<HTMLElement>): void => {
      if (Math.abs(e.deltaY) < ECHO_SWIPE_NOISE_PX) return;
      const now = Date.now();
      if (now - lastWheelAtRef.current < ECHO_WHEEL_THROTTLE_MS) return;
      lastWheelAtRef.current = now;
      applyAction(e.deltaY > 0 ? 'next' : 'prev');
    },
    [applyAction],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>): void => {
      switch (e.key) {
        case 'ArrowDown':
        case 'j':
          e.preventDefault();
          applyAction('next');
          break;
        case 'ArrowUp':
        case 'k':
          e.preventDefault();
          applyAction('prev');
          break;
        case 's':
        case 'S':
          applyAction('save-place');
          break;
        case 'f':
        case 'F':
          applyAction('follow-traveller');
          break;
        case 'p':
        case 'P':
          applyAction('plan-like-this');
          break;
      }
    },
    [applyAction],
  );

  return { onPointerDown, onPointerUp, onPointerCancel, onWheel, onKeyDown };
}
