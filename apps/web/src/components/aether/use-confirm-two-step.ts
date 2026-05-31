/**
 * AE332 — "tap once to arm, tap again to confirm" hook.
 *
 * Used by AE118 on /me to gate `clearRecentPrompts()`: the first tap
 * arms the button (label + colour swap, returns), the second tap
 * within the window fires the action and disarms. If no second tap
 * arrives in `windowMs`, the arm state silently resets so a stale
 * "Confirm?" never lingers.
 *
 * Pure hook: returns `{armed, onPress, reset}`. Consumers control
 * label / colour / aria copy from `armed`.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseConfirmTwoStepResult {
  readonly armed: boolean;
  readonly onPress: () => void;
  readonly reset: () => void;
}

export function useConfirmTwoStep(
  action: () => void,
  windowMs: number = 4000,
): UseConfirmTwoStepResult {
  const [armed, setArmed] = useState<boolean>(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    clearTimer();
    setArmed(false);
  }, [clearTimer]);

  const onPress = useCallback(() => {
    if (!armed) {
      setArmed(true);
      clearTimer();
      timerRef.current = setTimeout(() => setArmed(false), windowMs);
      return;
    }
    clearTimer();
    setArmed(false);
    action();
  }, [armed, action, windowMs, clearTimer]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  return { armed, onPress, reset };
}
