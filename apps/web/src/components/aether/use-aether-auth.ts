/**
 * AE354 — composite auth hook for Aether surfaces.
 *
 * Ten Aether routes (account, plan, journeys, shares, dashboard,
 * destination, journal, me, dispatch, pulse) repeat the same trio:
 *
 *     const token = useAuthToken();
 *     const bootComplete = useAuthBootComplete();
 *     const isAuthed = bootComplete && token !== null;
 *
 * Folding into one hook keeps the auth contract centralised and lets
 * a future "also check role" / "also expose userId" extension land in
 * one file. Returns the same three values so consumers destructure.
 */
import { useAuthBootComplete, useAuthToken } from '../../lib/use-auth-token';

export interface AetherAuthState {
  readonly token: string | null;
  readonly bootComplete: boolean;
  readonly isAuthed: boolean;
}

export function useAetherAuth(): AetherAuthState {
  const token = useAuthToken();
  const bootComplete = useAuthBootComplete();
  return {
    token,
    bootComplete,
    isAuthed: bootComplete && token !== null,
  };
}
