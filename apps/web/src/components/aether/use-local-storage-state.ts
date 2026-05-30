/**
 * AE247 — shared "persist React state to localStorage" hook.
 *
 * Builds on AE238 safe-storage so SSR safety + throw safety + JSON
 * fallback are inherited. Pattern:
 *
 *   const [open, setOpen] = useLocalStorageState('aether-foo-open', false);
 *
 * Behaviour:
 *   - first render returns the parsed-from-storage value or fallback
 *   - setState mirrors React's useState (value or functional updater)
 *   - every commit writes to storage via writeJSON; failed writes
 *     silently drop (state still updates so the UI stays responsive)
 *
 * `enabled = false` lets the caller skip persistence (e.g. private
 * tab fallback) without removing the hook call site.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { readJSON, writeJSON } from '../../lib/safe-storage';

export interface UseLocalStorageStateOptions {
  readonly enabled?: boolean;
}

export function useLocalStorageState<T>(
  key: string,
  fallback: T,
  opts: UseLocalStorageStateOptions = {},
): [T, (next: T | ((prev: T) => T)) => void] {
  const enabled = opts.enabled ?? true;
  const initialRef = useRef<T | null>(null);
  if (initialRef.current === null) {
    initialRef.current = enabled === true ? readJSON<T>(key, fallback) : fallback;
  }
  const [value, setValue] = useState<T>(initialRef.current);

  const setAndPersist = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const out = typeof next === 'function' ? (next as (prev: T) => T)(prev) : (next as T);
        if (enabled === true) writeJSON(key, out);
        return out;
      });
    },
    [enabled, key],
  );

  // Re-sync on key change so two components on different keys don't
  // clobber each other if hot-reloaded.
  useEffect(() => {
    if (enabled === false) return;
    setValue(readJSON<T>(key, fallback));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  return [value, setAndPersist];
}
