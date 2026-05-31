'use client';

/**
 * AE402 — `<LumenSelectionProvider>` + `useLumenSelection()`.
 *
 * State container for which photo plane is currently focused. The
 * Lumen scene reads this to dim unfocused planes + dolly the camera
 * via the AE402 pure helpers. AE403's keyboard nav writes through the
 * same setter so click + Arrow keys converge on one source of truth.
 *
 * Defaults to `{focusedId: null}` outside the provider so the scene
 * can be rendered in Storybook fixtures (and in jsdom tests) without
 * wiring the shell.
 */
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

export interface LumenSelectionValue {
  /** Asset id of the focused plane, or null when in overview mode. */
  readonly focusedId: string | null;
  /** Set the focused plane (null to return to overview). */
  setFocusedId(id: string | null): void;
  /** Convenience: clear focus (Esc key path). */
  clearFocus(): void;
}

const NULL_SELECTION: LumenSelectionValue = Object.freeze({
  focusedId: null,
  setFocusedId() {
    /* no-op outside provider */
  },
  clearFocus() {
    /* no-op outside provider */
  },
});

const LumenSelectionContext = createContext<LumenSelectionValue>(NULL_SELECTION);

export interface LumenSelectionProviderProps {
  /** Initial focused id. Tests + Storybook pin this; the live shell
   *  starts in overview mode. */
  readonly initialFocusedId?: string | null;
  children: ReactNode;
}

export function LumenSelectionProvider({
  initialFocusedId = null,
  children,
}: LumenSelectionProviderProps): React.ReactElement {
  const [focusedId, setFocusedId] = useState<string | null>(initialFocusedId);
  const clearFocus = useCallback(() => setFocusedId(null), []);
  return (
    <LumenSelectionContext.Provider value={{ focusedId, setFocusedId, clearFocus }}>
      {children}
    </LumenSelectionContext.Provider>
  );
}

export function useLumenSelection(): LumenSelectionValue {
  return useContext(LumenSelectionContext);
}
