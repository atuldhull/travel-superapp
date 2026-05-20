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
