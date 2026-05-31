/**
 * AE346 — pure adapter from orval's `useTripControllerList` response
 * to a clean TripDto[].
 *
 * Five Aether surfaces (destination, me-home, journeys, shares,
 * dispatch) inline the same `(q.data?.data as { trips?: TripDto[] }
 * | undefined)?.trips ?? []` ladder. The cast + null-fallback is a
 * type-generation artefact (orval doesn't surface the typed
 * envelope), so it deserves to live in one place where a future
 * sdk-generator upgrade can fix the contract.
 *
 * `TQuery` is structural — we don't import the orval UseQueryResult
 * type to keep this helper specs-cheap. Any object with
 * `data?.data` reaches the same trips array.
 */

interface TripLike {
  readonly id: string;
}

interface QueryShape<T> {
  readonly data?: { readonly data?: T };
}

export function tripsFromQuery<T extends TripLike>(
  query: QueryShape<{ trips?: ReadonlyArray<T> }> | undefined,
): ReadonlyArray<T> {
  const trips = query?.data?.data?.trips;
  if (!Array.isArray(trips)) return [];
  return trips;
}
