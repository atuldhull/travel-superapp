/**
 * AE327 — pure summariser for the /me header chip strip.
 *
 * `<MeHome/>` renders "N drafts · M trips total" derived inline from
 * the active + archived trip lists. The math is trivial but the
 * filter predicate (status === 'draft') is the kind of thing a future
 * "include planning + booked" change would have to find in every
 * surface. Centralising makes that one edit.
 *
 * Input is structurally typed (NOT TripDto) so the helper works for
 * any list of objects with `status`. Output is a plain object so
 * adding a 4th counter later doesn't change the call signature.
 */

export interface TripLikeStatus {
  readonly status?: string | null;
}

export interface TripStatsSummary {
  readonly drafts: number;
  readonly totalTrips: number;
  readonly archived: number;
  readonly active: number;
}

export function summariseTripStats(inputs: {
  readonly active: ReadonlyArray<TripLikeStatus>;
  readonly archived: ReadonlyArray<TripLikeStatus>;
}): TripStatsSummary {
  const drafts = inputs.active.filter((t) => t.status === 'draft').length;
  return {
    drafts,
    active: inputs.active.length,
    archived: inputs.archived.length,
    totalTrips: inputs.active.length + inputs.archived.length,
  };
}
