/**
 * AE229 — shared "debounce a fast-changing value" hook.
 *
 * Atlas search input + Pulse composer suggestions + future Pulse
 * voice transcript settle would all benefit from a single debounce
 * primitive. Pattern:
 *
 *   const debouncedQuery = useDebouncedValue(rawQuery, 200);
 *   useEffect(() => fetch(debouncedQuery), [debouncedQuery]);
 *
 * Behaviour:
 *   - first render returns the current `value` as the debounced state
 *   - subsequent updates start a timer; if `value` changes again
 *     before `delayMs` elapses, the timer restarts (last-write-wins)
 *   - unmount clears the pending timer
 *   - `delayMs <= 0` reduces to "always return current value" (no
 *     debounce, useful for tests / a11y modes)
 */
import { useEffect, useRef, useState } from 'react';

export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (delayMs <= 0) {
      setDebounced(value);
      return;
    }
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      setDebounced(value);
      timerRef.current = null;
    }, delayMs);
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [value, delayMs]);

  return debounced;
}
