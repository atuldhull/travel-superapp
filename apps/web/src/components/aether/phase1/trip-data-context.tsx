'use client';

/**
 * `<TripDataProvider>` + `useTripData()` — shuttle trip + itinerary into
 * the Atlas Phase 1 scene via React Context.
 *
 * The R3F scene component (`atlas-phase1-scene.tsx`) is loaded via
 * `Surface.mount` and only receives `{ surface, phase }` from AE374's
 * mount contract. Trip-shaped data lives outside that contract, so we
 * provide it through Context that the shell wires once and the scene
 * reads on every render.
 *
 * Why a dedicated context and not just lift state: scenes are lazy-loaded
 * via `React.lazy(surface.mount)`. The first paint of the scene happens
 * AFTER the registry resolves and the lazy chunk loads — using context
 * lets the data flow be ready without prop-drilling through
 * `SurfaceCanvas` + `Suspense`.
 */
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { AtlasDayLike } from './atlas-orbs';

export interface TripDataLike {
  readonly id: string;
  readonly title: string;
  readonly startsOn: string | null;
  readonly endsOn: string | null;
  readonly status: string;
}

export interface TripDataContextValue {
  readonly trip: TripDataLike | null;
  readonly days: ReadonlyArray<AtlasDayLike>;
  /** True while the SDK request is pending. */
  readonly isPending: boolean;
  /** True iff the SDK request errored. */
  readonly isError: boolean;
}

const TripDataContext = createContext<TripDataContextValue | null>(null);

export interface TripDataProviderProps {
  trip: TripDataLike | null;
  days: ReadonlyArray<AtlasDayLike>;
  isPending: boolean;
  isError: boolean;
  children: ReactNode;
}

export function TripDataProvider({
  trip,
  days,
  isPending,
  isError,
  children,
}: TripDataProviderProps): React.ReactElement {
  const value = useMemo<TripDataContextValue>(
    () => ({ trip, days, isPending, isError }),
    [trip, days, isPending, isError],
  );
  return <TripDataContext.Provider value={value}>{children}</TripDataContext.Provider>;
}

/** Read the active trip data. Throws outside provider so a misplaced
 *  scene tree surfaces loudly during dev. */
export function useTripData(): TripDataContextValue {
  const ctx = useContext(TripDataContext);
  if (ctx === null) {
    throw new Error('useTripData() called outside <TripDataProvider>.');
  }
  return ctx;
}
