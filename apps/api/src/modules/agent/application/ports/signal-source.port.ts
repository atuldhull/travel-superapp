/**
 * POST.2A.1 — port for a world-signal source the agent polls.
 *
 * Real adapters land in POST.2A.3: a weather signal that REUSES the
 * existing WEATHER_PROVIDER port (no new HTTP client) and a new
 * OpenSky flight adapter (free, anonymous, native fetch). The stub
 * is the always-safe default registered in this slice.
 *
 * LAW 2: a query carries only trip-relevant coordinates — never
 * user PII (email / name / home).
 *
 * Installed by prompt [POST.2A.1].
 */
import type { SignalKind } from '../../domain/trip-watch.entity';

/**
 * Phase 6 (I4) — one recent scam report near a trip center, as the
 * `safety_proximity` adapter sees it. This is aggregate, NON-PII
 * data: a distance + verified flag + recency, never a reporter
 * identity or exact address (LAW 2).
 */
export interface NearbyScamReport {
  /** Great-circle distance from the trip center, in kilometres. */
  readonly distanceKm: number;
  /** True only for community/moderator-verified reports. */
  readonly verified: boolean;
  /** Whole days since the report was observed (0 = today). */
  readonly observedDaysAgo: number;
}

export interface SignalSourceQuery {
  readonly kind: SignalKind;
  readonly lat: number;
  readonly lng: number;
  /**
   * Phase 3 (G5) — optional ISO date for the `deadline` kind. NOT
   * PII (it's a trip date, same class as lat/lng). Other kinds may
   * ignore it. Absence is honest: the deadline adapter returns
   * `{ changed: false }` when this isn't supplied.
   */
  readonly tripStartsOnIso?: string;
  /**
   * Phase 6 (I4) — optional recent scam reports near the trip
   * centre, for the `safety_proximity` kind. NON-PII (see
   * NearbyScamReport). Other kinds ignore it. Absence is honest:
   * the safety-proximity adapter returns `{ changed: false }` when
   * this isn't supplied — opt-in, nothing fires by default (LAW 2).
   */
  readonly nearbyScamReports?: readonly NearbyScamReport[];
}

export interface SignalSnapshot {
  readonly kind: SignalKind;
  readonly observedAt: Date;
  /**
   * Provider-neutral, pure-data payload. `changed: false` is the
   * deterministic "nothing material" snapshot the stub returns.
   */
  readonly data: Readonly<Record<string, unknown>>;
}

export interface SignalSource {
  snapshot(query: SignalSourceQuery): Promise<SignalSnapshot>;
}

export const SIGNAL_SOURCE_PORT = Symbol('SignalSource');
