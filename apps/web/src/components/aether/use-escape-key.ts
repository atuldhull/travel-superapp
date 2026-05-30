/**
 * AE219 — shared "press Escape to dismiss" hook.
 *
 * Several Aether surfaces handle Escape inline — Pulse drawer,
 * KeyboardHelp overlay, Pulse copy-bubble, future modals. The
 * convention is consistent:
 *   - listen on window (so a focused control inside still fires it)
 *   - only when `enabled` is true (so dismissed components stop)
 *   - call preventDefault (so the browser's default Escape behaviour
 *     — closing the address-bar overlay, etc. — doesn't fight us)
 *
 * This hook canonicalises the pattern with proper cleanup.
 */
import { useEffect } from 'react';

export interface UseEscapeKeyOptions {
  readonly enabled: boolean;
  readonly onEscape: () => void;
}

export function useEscapeKey(opts: UseEscapeKeyOptions): void {
  const { enabled, onEscape } = opts;
  useEffect(() => {
    if (enabled === false) return;
    const handler = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      onEscape();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [enabled, onEscape]);
}
