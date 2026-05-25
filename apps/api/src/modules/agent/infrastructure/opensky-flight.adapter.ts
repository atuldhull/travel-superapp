/**
 * POST.2A.3 — flight signal source (OpenSky, free, anonymous).
 *
 * Best-effort + clearly-labelled per decision D3: there is no free
 * scheduled-flight-status SLA, and a watch carries no flight number
 * yet, so this adapter probes OpenSky's anonymous `/states/all`
 * within a bbox around the trip and currently always reports
 * `delayed: false` (it proves the pattern + reachability without
 * fabricating a delay signal). Real delay detection needs a flight
 * number on the watch — a deliberately deferred later prompt.
 *
 * LAW 1: any failure/timeout → deterministic "no change" (the loop
 * never breaks on a dead upstream). LAW 2: only a numeric bbox
 * derived from trip coords leaves the system — no user PII. No SDK
 * (native fetch), no key.
 *
 * Installed by prompt [POST.2A.3].
 */
import { Inject, Injectable } from '@nestjs/common';
import { createLogger, type AppLogger } from '@app/logger';
import { CLOCK, type Clock } from '@app/clock';
import type {
  SignalSnapshot,
  SignalSource,
  SignalSourceQuery,
} from '../application/ports/signal-source.port';

const TIMEOUT_MS = 4000;
const BBOX_DEG = 0.5;

/** Pure, unit-testable: builds the anonymous OpenSky URL. Contains
 *  ONLY a numeric bbox — asserted PII-free by the spec. */
export function buildStatesUrl(baseUrl: string, lat: number, lng: number): string {
  const base = baseUrl.replace(/\/+$/, '');
  const lamin = (lat - BBOX_DEG).toFixed(4);
  const lamax = (lat + BBOX_DEG).toFixed(4);
  const lomin = (lng - BBOX_DEG).toFixed(4);
  const lomax = (lng + BBOX_DEG).toFixed(4);
  return `${base}/states/all?lamin=${lamin}&lamax=${lamax}&lomin=${lomin}&lomax=${lomax}`;
}

function noChange(): SignalSnapshot {
  return {
    kind: 'flight',
    observedAt: new Date(0),
    data: Object.freeze({ delayed: false }),
  };
}

@Injectable()
export class OpenSkyFlightAdapter implements SignalSource {
  private readonly logger: AppLogger = createLogger('agent.signal.flight');

  constructor(
    private readonly baseUrl: string,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async snapshot(query: SignalSourceQuery): Promise<SignalSnapshot> {
    const url = buildStatesUrl(this.baseUrl, query.lat, query.lng);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) {
        this.logger.warn({ status: res.status }, 'flight_signal_degraded');
        return noChange();
      }
      // States parsed for reachability only; no delay model yet (D3).
      await res.json();
      return {
        kind: 'flight',
        observedAt: this.clock.now(),
        data: Object.freeze({ delayed: false }),
      };
    } catch (err) {
      this.logger.warn(
        { err: err instanceof Error ? err.message : String(err) },
        'flight_signal_degraded',
      );
      return noChange();
    } finally {
      clearTimeout(timer);
    }
  }
}
