/**
 * `<SurfaceManagerProvider>` + the hook trio that reads from it.
 *
 * Wires the pure pieces together: registry holds Surfaces, route-matcher
 * picks one for the current pathname, lifecycle FSM tracks where the active
 * Surface is in its materialise → settle → listen → dissolve loop.
 *
 * Caller wires the URL: typically `apps/web/src/components/aether/surface-host.tsx`
 * subscribes to `usePathname()` from `next/navigation` and forwards it via
 * `setRoute`. The provider itself stays framework-agnostic so the same
 * registry can drive Storybook (manual `setRoute`) + apps/web + apps/mobile.
 *
 * Phase 1 flag-gating: when `NEXT_PUBLIC_FEATURE_AETHER_PHASE1` is off, the
 * caller still mounts the provider but the route-matcher only sees Phase 1
 * Surfaces (filter applied at registration time, not in here). That keeps
 * this layer flag-unaware.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { SurfaceRegistry } from './registry';
import { overlaySurfaces, routeToSurface } from './route-to-surface';
import type { Surface, SurfaceId, SurfaceLifecyclePhase } from './types';

/** What `useSurfaceManager()` exposes — the state + the imperative setters. */
export interface SurfaceManagerState {
  /** The registry instance (passed through; consumers rarely need it). */
  readonly registry: SurfaceRegistry;
  /** Current pathname the manager is tracking. */
  readonly pathname: string;
  /** Route-bound Surface for `pathname`, or null if none match. */
  readonly current: Surface | null;
  /** Lifecycle phase of `current`. Always `'idle'` when `current` is null. */
  readonly phase: SurfaceLifecyclePhase;
  /** Overlay Surfaces (Pulse + Continuum); render alongside `current`. */
  readonly overlays: ReadonlyArray<Surface>;
  /** SurfaceId the Predictor expects the user to navigate to next (Phase 5).
   *  Null until a predictor wires it via `anticipate()`. */
  readonly anticipating: SurfaceId | null;

  setRoute(pathname: string): void;
  setPhase(phase: SurfaceLifecyclePhase): void;
  anticipate(id: SurfaceId | null): void;
}

export interface SurfaceManagerProviderProps {
  registry: SurfaceRegistry;
  /** Initial pathname — defaults to `'/'`. Storybook passes a fixed string;
   *  apps/web wires `usePathname()`. */
  initialPathname?: string;
  /** Initial lifecycle phase — defaults to `'idle'`. */
  initialPhase?: SurfaceLifecyclePhase;
  children: ReactNode;
}

const SurfaceManagerContext = createContext<SurfaceManagerState | null>(null);

export function SurfaceManagerProvider({
  registry,
  initialPathname = '/',
  initialPhase = 'idle',
  children,
}: SurfaceManagerProviderProps): React.ReactElement {
  const [pathname, setPathname] = useState<string>(initialPathname);
  const [phase, setPhase] = useState<SurfaceLifecyclePhase>(initialPhase);
  const [anticipating, setAnticipating] = useState<SurfaceId | null>(null);

  // Recompute the route-bound + overlay Surfaces only when the registry's
  // identity or the pathname change. Registry identity is stable across
  // renders (caller passes the same instance), so this fires once per nav.
  const surfaces = useMemo(() => registry.list(), [registry]);
  const current = useMemo(() => routeToSurface(pathname, surfaces) ?? null, [pathname, surfaces]);
  const overlays = useMemo(() => overlaySurfaces(surfaces), [surfaces]);

  const setRoute = useCallback((next: string) => {
    setPathname(next);
    // Reset lifecycle to idle on every nav — the new Surface's
    // materialise → settle pass is owned by AE375 once it lands. AE374
    // just hands the canvas package a clean starting state.
    setPhase('idle');
  }, []);

  const anticipate = useCallback((id: SurfaceId | null) => {
    setAnticipating(id);
  }, []);

  const value = useMemo<SurfaceManagerState>(
    () => ({
      registry,
      pathname,
      current,
      phase: current === null ? 'idle' : phase,
      overlays,
      anticipating,
      setRoute,
      setPhase,
      anticipate,
    }),
    [registry, pathname, current, phase, overlays, anticipating, setRoute, anticipate],
  );

  return <SurfaceManagerContext.Provider value={value}>{children}</SurfaceManagerContext.Provider>;
}

/** Full state + setters. Throws outside provider so misuse is loud. */
export function useSurfaceManager(): SurfaceManagerState {
  const ctx = useContext(SurfaceManagerContext);
  if (ctx === null) {
    throw new Error(
      'useSurfaceManager() called outside <SurfaceManagerProvider>. ' +
        'Wrap your tree in <SurfaceManagerProvider registry={...}> at the Aether root.',
    );
  }
  return ctx;
}

/** Read-only convenience — the active route-bound Surface or null. */
export function useCurrentSurface(): Surface | null {
  return useSurfaceManager().current;
}

/** Read-only convenience — the active Surface's lifecycle phase. */
export function useSurfaceLifecycle(): SurfaceLifecyclePhase {
  return useSurfaceManager().phase;
}
