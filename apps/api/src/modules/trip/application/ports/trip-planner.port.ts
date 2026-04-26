/**
 * Port: AI-backed trip-plan generator. The use-case calls
 * `generatePlan(...)` to get a free-form suggestion the user can
 * read alongside the deterministic itinerary stub.
 *
 * Two adapters today:
 *   - `ClaudeTripPlannerAdapter` — Anthropic Claude Sonnet via
 *     @anthropic-ai/sdk. Registered when `CLAUDE_API_KEY` is set.
 *   - `StubTripPlannerAdapter` — deterministic placeholder. Registered
 *     when the env var is missing so dev / CI never hard-depend on a
 *     paid LLM call.
 *
 * Installed by prompt [IV.18.19.44].
 */
export const TRIP_PLANNER_PORT = Symbol('TRIP_PLANNER_PORT');

export interface TripPlannerRequest {
  readonly title: string;
  readonly center: { readonly lng: number; readonly lat: number };
  readonly radiusKm: number;
  readonly startsOn: Date | null;
  readonly endsOn: Date | null;
}

export interface TripPlannerResult {
  readonly plan: string;
  readonly model: string;
}

export interface TripPlannerPort {
  generatePlan(request: TripPlannerRequest): Promise<TripPlannerResult>;
}
