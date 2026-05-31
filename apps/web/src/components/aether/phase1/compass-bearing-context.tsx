'use client';

/**
 * `<CompassBearingProvider>` + `useCompassBearing()` — shuttle the
 * current target bearing into the Compass scene.
 *
 * Phase 1 first cut (AE379) ships with a constant bearing (default 0°
 * = North). Later slices wire actual geolocation + "bearing to next
 * waypoint" math.
 *
 * Same pattern as `<TripDataProvider>` (AE378): the Compass scene is
 * lazy-loaded by Surface.mount and only receives `{surface, phase}`
 * from AE374, so external data flows via Context.
 */
import { createContext, useContext, type ReactNode } from 'react';

const CompassBearingContext = createContext<number>(0);

export interface CompassBearingProviderProps {
  /** Bearing in degrees clockwise from north. Default 0° (north). */
  bearing?: number;
  children: ReactNode;
}

export function CompassBearingProvider({
  bearing = 0,
  children,
}: CompassBearingProviderProps): React.ReactElement {
  return (
    <CompassBearingContext.Provider value={bearing}>{children}</CompassBearingContext.Provider>
  );
}

/** Read the current target bearing. Returns 0° (north) when no provider
 *  is mounted — the Compass scene must always have a valid bearing so we
 *  don't throw here. */
export function useCompassBearing(): number {
  return useContext(CompassBearingContext);
}
