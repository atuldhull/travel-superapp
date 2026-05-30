/**
 * AE211 — shared "✓ copied" tap-feedback hook.
 *
 * AE113 (TripChecklist) + AE189 (Pulse copy-bubble) each maintain
 * their own `copiedIdx`/`copied` boolean + setTimeout pair, all
 * with subtly different teardown logic. This hook canonicalises:
 *
 *   const { copied, flash } = useCopyTapFeedback(1500);
 *   <button onClick={() => copyTextToClipboard(t).then((ok) => ok && flash())}>
 *     {copied ? '✓ copied' : 'Copy'}
 *   </button>
 *
 * The hook clears any pending timer on unmount AND on re-flash, so
 * rapid taps reset the window cleanly without leaking timers.
 *
 * Note: this slice exposes the hook for future consumers; existing
 * callers in TripChecklist + Pulse keep their bespoke state until a
 * dedicated migration slice swaps them. Each migration is a no-op
 * behavioural change but should land with its own spec.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export interface CopyTapFeedback {
  readonly copied: boolean;
  /** Mark "✓ copied", then auto-revert after `windowMs`. Safe to call
   *  repeatedly — restarts the timer. */
  readonly flash: () => void;
}

export function useCopyTapFeedback(windowMs: number = 1500): CopyTapFeedback {
  const [copied, setCopied] = useState<boolean>(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flash = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }
    setCopied(true);
    timerRef.current = setTimeout(() => {
      setCopied(false);
      timerRef.current = null;
    }, windowMs);
  }, [windowMs]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  return { copied, flash };
}
