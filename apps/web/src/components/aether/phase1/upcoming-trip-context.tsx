'use client';

/**
 * AE393 — `<UpcomingTripProvider>` + `useUpcomingTrip()`.
 *
 * Flows the resolved "next upcoming trip" into the DriftNowCard. The
 * SDK call + the `pickUpcomingTrip(...)` selection happen in the Drift
 * shell (where `useAetherTripList()` already has auth context); this
 * provider just exposes the pick to the foreground card.
 *
 * Defaults to `null` outside the provider so the card can be rendered
 * in Storybook fixtures + jsdom tests without wiring auth.
 */
import { createContext, useContext, type ReactNode } from 'react';
import type { UpcomingTripLike } from './upcoming-trip';

const UpcomingTripContext = createContext<UpcomingTripLike | null>(null);

export interface UpcomingTripProviderProps {
  /** The trip to surface in the Now Card. Pass `null` (or omit) when no
   *  trip qualifies — the card then falls back to AE385 time-of-day. */
  trip?: UpcomingTripLike | null;
  children: ReactNode;
}

export function UpcomingTripProvider({
  trip = null,
  children,
}: UpcomingTripProviderProps): React.ReactElement {
  return <UpcomingTripContext.Provider value={trip}>{children}</UpcomingTripContext.Provider>;
}

/** Read the current upcoming trip. Returns `null` outside the provider. */
export function useUpcomingTrip(): UpcomingTripLike | null {
  return useContext(UpcomingTripContext);
}
