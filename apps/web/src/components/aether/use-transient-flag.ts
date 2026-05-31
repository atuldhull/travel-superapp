/**
 * AE347 — "flash a boolean for N ms" hook.
 *
 * Used by `/aether/account` for ✓-checkmarks after a download
 * (PulseExported, PulseCleared, DataExported all do `setX(true);
 * window.setTimeout(() => setX(false), 2000)`). Hook owns the timer
 * cleanup so unmount during the window doesn't leak a setState into
 * a dead component.
 *
 * Returns `[flag, trigger]`. trigger() flips to true + schedules
 * the auto-disarm. Calling trigger() while still armed restarts the
 * timer (the user just did the thing again — keep the chip alive).
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export function useTransientFlag(durationMs: number = 2000): readonly [boolean, () => void] {
  const [flag, setFlag] = useState<boolean>(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const trigger = useCallback(() => {
    clearTimer();
    setFlag(true);
    timerRef.current = setTimeout(() => setFlag(false), durationMs);
  }, [durationMs, clearTimer]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  return [flag, trigger] as const;
}
