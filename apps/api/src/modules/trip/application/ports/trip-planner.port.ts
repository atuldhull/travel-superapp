/**
 * Port: AI-backed trip-plan generator. The use-case calls
 * `generatePlan(...)` and gets back a free-form prose plan plus the
 * provider identifier so the UI can show a "powered by …" badge.
 *
 * Four adapters today (registered in priority order by trip.module.ts):
 *   1. `ClaudeTripPlannerAdapter`  — Anthropic Claude, gated on
 *      `ANTHROPIC_API_KEY`. Premium paid tier.
 *   2. `GeminiTripPlannerAdapter`  — Google Gemini Flash, gated on
 *      `GEMINI_API_KEY`. Free tier (1500 req/day, no card).
 *   3. `OllamaTripPlannerAdapter`  — Local LLM via Ollama HTTP,
 *      gated on `OLLAMA_URL`. Truly $0, runs offline.
 *   4. `StubTripPlannerAdapter`    — deterministic prose. Always
 *      registered so dev / CI / unprovisioned envs keep working.
 *
 * Adding a provider is purely additive — flip the factory in
 * `trip.module.ts` and ship a new adapter that satisfies this shape.
 *
 * Installed by prompt [IV.18.19.44]. Multi-provider chain in [POST.4].
 */
export const TRIP_PLANNER_PORT = Symbol('TRIP_PLANNER_PORT');

export interface TripPlannerRequest {
  readonly title: string;
  readonly center: { readonly lng: number; readonly lat: number };
  readonly radiusKm: number;
  readonly startsOn: Date | null;
  readonly endsOn: Date | null;
}

/** Token-usage report. Anthropic + Gemini return precise counts;
 *  Ollama doesn't reliably surface them so the stub + Ollama adapters
 *  omit this field. */
export interface TripPlannerTokenUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cachedTokens?: number;
}

/** Stable string identifier for the underlying provider — drives
 *  the "powered by …" badge on /trips/[id]. */
export type TripPlannerProvider = 'anthropic' | 'gemini' | 'ollama' | 'stub';

export interface TripPlannerResult {
  readonly plan: string;
  readonly model: string;
  readonly provider: TripPlannerProvider;
  readonly tokenUsage?: TripPlannerTokenUsage;
}

export interface TripPlannerPort {
  generatePlan(request: TripPlannerRequest): Promise<TripPlannerResult>;
}
