/**
 * AE362 — composite wrapper around orval's `useTripControllerList`.
 *
 * Five Aether surfaces (me-home, me/journeys, me/shares, dispatch,
 * destination) call the same orval hook with the same shape of
 * params + the same `tripsFromQuery` extractor on the response. This
 * helper folds the orval surface area into one ergonomic call:
 *
 *     const { trips, isPending } = useAetherTripList({
 *       archived: false,
 *       limit: '100',
 *       enabled: isAuthed,
 *     });
 *
 * Keeps the underlying query object reachable via `raw` for surfaces
 * that need it (e.g. `useQueryClient().invalidateQueries(activeQuery.…)`).
 */
import { useTripControllerList, type TripDto } from '@app/sdk';
import { tripsFromQuery } from '../../lib/trips-from-query';

export interface UseAetherTripListInputs {
  /** Default = false (i.e. "active trips"). */
  readonly archived?: boolean;
  /** Mirrors orval's `limit` param (string, not number). */
  readonly limit: string;
  /** Pass-through to react-query's `enabled` gate. */
  readonly enabled: boolean;
  /** Pass-through retry count; orval defaults to 3, we usually want 1. */
  readonly retry?: number;
}

export interface UseAetherTripListResult {
  readonly trips: ReadonlyArray<TripDto>;
  readonly isPending: boolean;
  readonly isError: boolean;
  // Surface the raw query object so callers can invalidate / refetch.
  readonly raw: ReturnType<typeof useTripControllerList>;
}

export function useAetherTripList(inputs: UseAetherTripListInputs): UseAetherTripListResult {
  const query = useTripControllerList(
    { limit: inputs.limit, archived: inputs.archived === true ? 'true' : 'false' },
    { query: { enabled: inputs.enabled, retry: inputs.retry ?? 1 } },
  );
  return {
    trips: tripsFromQuery<TripDto>(query),
    isPending: query.isPending,
    isError: query.isError,
    raw: query,
  };
}
