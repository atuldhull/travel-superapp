/**
 * Reduced-motion / motion-policy hook + context.
 *
 * The Aether motion system is bold by default. This module is the
 * gate that turns it down — for users who set
 * `prefers-reduced-motion: reduce`, for users who toggled the in-app
 * "calmer animations" setting, and for the iframe + Storybook
 * environments that should never animate.
 *
 * Returns a `MotionPolicy` enum, not a boolean — Aether distinguishes
 * "no motion at all" from "essential motion only" from "full".
 */
import { createContext, useContext, useEffect, useState, useMemo, type ReactNode } from 'react';

/** What level of motion to render. */
export type MotionPolicy =
  /** No animation — instant transitions, no springs. Honors prefers-reduced-motion reduce. */
  | 'none'
  /** Only motion that conveys structure (sheet enters from bottom, etc.); no decorative motion. */
  | 'essential'
  /** Default — full Aether motion stack. */
  | 'full';

export interface ReducedMotionState {
  /** Current resolved policy after merging system + user prefs. */
  readonly policy: MotionPolicy;
  /** Raw system-level prefers-reduced-motion value. */
  readonly systemReducedMotion: boolean;
  /** User in-app override (settings page). null = no override. */
  readonly userOverride: MotionPolicy | null;
  /** Set user override; persists via the provider's `persist` callback. */
  setUserOverride(next: MotionPolicy | null): void;
}

const ReducedMotionContext = createContext<ReducedMotionState | null>(null);

/** Read the SSR-safe system pref. Returns false during SSR. */
function readSystemPref(): boolean {
  if (typeof window === 'undefined') return false;
  if (typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Resolve the effective policy from the two signals. */
function resolvePolicy(systemReduced: boolean, override: MotionPolicy | null): MotionPolicy {
  // User override is authoritative when present.
  if (override !== null) return override;
  // Otherwise system reduced-motion = essential.
  return systemReduced ? 'essential' : 'full';
}

export interface ReducedMotionProviderProps {
  /** Initial user override (e.g. loaded from User.audioOptOut or localStorage). */
  initialOverride?: MotionPolicy | null;
  /** Called when user changes the override; persist to wherever you want. */
  onOverrideChange?: (next: MotionPolicy | null) => void;
  children: ReactNode;
}

export function ReducedMotionProvider({
  initialOverride = null,
  onOverrideChange,
  children,
}: ReducedMotionProviderProps): React.ReactElement {
  const [systemReduced, setSystemReduced] = useState<boolean>(() => readSystemPref());
  const [override, setOverride] = useState<MotionPolicy | null>(initialOverride);

  // Subscribe to system-pref changes.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent): void => setSystemReduced(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  const setUserOverride = useMemo(
    () => (next: MotionPolicy | null) => {
      setOverride(next);
      onOverrideChange?.(next);
    },
    [onOverrideChange],
  );

  const value = useMemo<ReducedMotionState>(
    () => ({
      policy: resolvePolicy(systemReduced, override),
      systemReducedMotion: systemReduced,
      userOverride: override,
      setUserOverride,
    }),
    [systemReduced, override, setUserOverride],
  );

  return <ReducedMotionContext.Provider value={value}>{children}</ReducedMotionContext.Provider>;
}

/** Read the current motion policy. Throws outside provider. */
export function useMotionPolicy(): MotionPolicy {
  const ctx = useContext(ReducedMotionContext);
  if (ctx === null) {
    throw new Error(
      'useMotionPolicy() called outside <ReducedMotionProvider>. ' +
        'Wrap your tree in <AetherProvider> at the app root.',
    );
  }
  return ctx.policy;
}

/** Read the full state (for settings page). Throws outside provider. */
export function useReducedMotion(): ReducedMotionState {
  const ctx = useContext(ReducedMotionContext);
  if (ctx === null) {
    throw new Error('useReducedMotion() called outside <ReducedMotionProvider>.');
  }
  return ctx;
}

/** Internal test export — for asserting resolved value without a provider. */
export const __testing = { resolvePolicy };
