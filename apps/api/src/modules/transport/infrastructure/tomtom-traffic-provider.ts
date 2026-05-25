/**
 * Real traffic via TomTom Traffic Flow (`flowSegmentData`). Active
 * only when `TOMTOM_API_KEY` is set (limited free tier). We sample a
 * handful of points along the polyline, ask TomTom for the current
 * vs free-flow speed at each, classify the stretch, and roll the
 * worst classes into segments + an ETA penalty + advisories.
 *
 * Best-effort by contract: ANY failure (timeout, quota, non-200)
 * throws so `CompositeTrafficProvider` falls back to the deterministic
 * mock — live nav still works, just labelled "estimated".
 *
 * Native fetch, no SDK, short timeout, ≤6 sample calls per route to
 * stay well inside the free tier.
 *
 * Installed for the live-navigation feature.
 */
import { Inject, Injectable } from '@nestjs/common';
import { createLogger, type AppLogger } from '@app/logger';
import { CLOCK, type Clock } from '@app/clock';
import { CircuitBreaker, callExternal } from '@app/resilience';
import type {
  NavAdvisory,
  NavPoint,
  TrafficLevel,
  TrafficSegment,
} from '../domain/nav-route.entity';
import type {
  TrafficAnnotateInput,
  TrafficAnnotation,
  TrafficProvider,
} from '../application/ports/traffic-provider';

const TIMEOUT_MS = 4000;
const MAX_SAMPLES = 6;
const ENDPOINT = 'https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json';

interface FlowSegmentData {
  readonly flowSegmentData?: {
    readonly currentSpeed?: number;
    readonly freeFlowSpeed?: number;
    readonly roadClosure?: boolean;
  };
}

@Injectable()
export class TomTomTrafficProvider implements TrafficProvider {
  private readonly logger: AppLogger = createLogger('transport.traffic.tomtom');
  private readonly breaker: CircuitBreaker;

  constructor(
    private readonly apiKey: string,
    @Inject(CLOCK) clock: Clock,
  ) {
    // [O1] 5 fails / 60s. Each /annotate call fans out to 6 samples;
    // a degraded TomTom would otherwise hammer them all 6x per call.
    this.breaker = new CircuitBreaker({
      name: 'tomtom',
      clock,
      failureThreshold: 5,
      openMs: 60_000,
      onTransition: (from, to, name) =>
        this.logger.warn({ from, to, name }, 'circuit_state_change'),
    });
  }

  async annotate(input: TrafficAnnotateInput): Promise<TrafficAnnotation> {
    const n = input.geometry.length;
    if (n < 2) {
      return {
        segments: [],
        advisories: [],
        durationInTrafficSeconds: input.baseDurationSeconds,
        source: 'live',
      };
    }

    const sampleIdx = sampleIndexes(n, MAX_SAMPLES);
    const levels = await Promise.all(sampleIdx.map((i) => this.levelAt(input.geometry[i]!)));

    // Expand the per-sample classes back over the polyline: each
    // sample owns the span up to the next sample.
    const segments: TrafficSegment[] = [];
    for (let s = 0; s < sampleIdx.length; s += 1) {
      const from = sampleIdx[s]!;
      const to = s + 1 < sampleIdx.length ? sampleIdx[s + 1]! - 1 : n - 1;
      if (to >= from) segments.push({ fromIndex: from, toIndex: to, level: levels[s]! });
    }

    const advisories: NavAdvisory[] = [];
    const worst = worstLevel(levels);
    const firstBlocked = segments.find((g) => g.level === 'blocked');
    if (firstBlocked) {
      const at = input.geometry[firstBlocked.fromIndex]!;
      advisories.push({
        kind: 'blockage',
        message: 'Live closure on this route — not advised.',
        atLat: at.lat,
        atLng: at.lng,
      });
      advisories.push({
        kind: 'reroute',
        message: 'Take an alternative — this one is closed ahead.',
        atLat: at.lat,
        atLng: at.lng,
      });
    } else if (worst === 'heavy') {
      advisories.push({ kind: 'heavy_traffic', message: 'Live heavy traffic on this route.' });
    }

    const penalty =
      levels.reduce((acc, l) => acc + LEVEL_PENALTY[l], 0) / Math.max(1, levels.length);
    return {
      segments,
      advisories,
      durationInTrafficSeconds: Math.round(input.baseDurationSeconds * (1 + penalty)),
      source: 'live',
    };
  }

  private async levelAt(p: NavPoint): Promise<TrafficLevel> {
    const url = `${ENDPOINT}?key=${this.apiKey}&point=${p.lat},${p.lng}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await callExternal(() => fetch(url, { signal: ctrl.signal }), {
        breaker: this.breaker,
        label: 'tomtom.flowSegmentData',
      });
      if (!res.ok) throw new Error(`TomTom HTTP ${res.status}`);
      const json = (await res.json()) as FlowSegmentData;
      const d = json.flowSegmentData;
      if (!d) throw new Error('TomTom empty flowSegmentData');
      if (d.roadClosure) return 'blocked';
      const cur = d.currentSpeed ?? 0;
      const free = d.freeFlowSpeed ?? 0;
      if (free <= 0) return 'free';
      const ratio = cur / free;
      if (ratio >= 0.85) return 'free';
      if (ratio >= 0.6) return 'moderate';
      if (ratio >= 0.3) return 'heavy';
      return 'blocked';
    } catch (err) {
      this.logger.warn(
        { err: err instanceof Error ? err.message : String(err) },
        'tomtom_traffic_unavailable',
      );
      throw err instanceof Error ? err : new Error(String(err));
    } finally {
      clearTimeout(timer);
    }
  }
}

const LEVEL_PENALTY: Record<TrafficLevel, number> = {
  free: 0,
  moderate: 0.15,
  heavy: 0.4,
  blocked: 0.8,
};

function worstLevel(levels: readonly TrafficLevel[]): TrafficLevel {
  const order: readonly TrafficLevel[] = ['free', 'moderate', 'heavy', 'blocked'];
  return levels.reduce<TrafficLevel>(
    (acc, l) => (order.indexOf(l) > order.indexOf(acc) ? l : acc),
    'free',
  );
}

/** Evenly-spaced indexes including first + last. */
function sampleIndexes(n: number, max: number): number[] {
  const count = Math.min(max, n);
  if (count <= 1) return [0];
  const out: number[] = [];
  for (let i = 0; i < count; i += 1) {
    out.push(Math.round((i * (n - 1)) / (count - 1)));
  }
  return [...new Set(out)];
}
