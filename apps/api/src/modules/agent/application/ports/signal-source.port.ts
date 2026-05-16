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
