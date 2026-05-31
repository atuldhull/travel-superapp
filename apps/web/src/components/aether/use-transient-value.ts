/**
 * AE351 — sibling of AE347 useTransientFlag for "which item just
 * got copied / activated" surfaces.
 *
 * Used for the "✓ copied <code>" pattern in /me/shares + /brand
 * where the state has to remember WHICH item was the source of the
 * flash, not just whether one happened. Set returns the new value;
 * the timer auto-clears back to null after `durationMs`.
 *
 * Pure hook: returns `[current, set]`. `current` is `T | null`.
 * Calling `set(v)` immediately replaces + restarts the window; the
 * cleanup-on-unmount path is shared with useTransientFlag's, so
 * late setStates can't leak.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export function useTransientValue<T>(
  durationMs: number = 2000,
): readonly [T | null, (value: T) => void] {
  const [current, setCurrent] = useState<T | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const set = useCallback(
    (value: T) => {
      clearTimer();
      setCurrent(value);
      timerRef.current = setTimeout(() => setCurrent(null), durationMs);
    },
    [durationMs, clearTimer],
  );

  useEffect(() => () => clearTimer(), [clearTimer]);

  return [current, set] as const;
}
