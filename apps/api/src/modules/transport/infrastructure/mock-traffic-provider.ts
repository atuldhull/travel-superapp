/**
 * Deterministic synthetic traffic. Seeded from the route id + point
 * count so the same route always colours the same way (tests assert
 * on it, and the UI doesn't flicker between polls).
 *
 * Model:
 *   - A `heavy` band over the middle ~22–42% of the polyline (the
 *     "rush" stretch every route has).
 *   - On the `fastest` flavour ONLY, one short `blocked` stretch at
 *     ~40% + a reroute advisory — this is the demo that drives the
 *     "there's a blockage, take the alternative" recommendation.
 *   - Everything else is `free`.
 *   - ETA penalty: +28% over the heavy band, +65% over a blocked one.
 *
 * Installed for the live-navigation feature.
 */
import { Injectable } from '@nestjs/common';
import type { NavAdvisory, TrafficLevel, TrafficSegment } from '../domain/nav-route.entity';
import type {
  TrafficAnnotateInput,
  TrafficAnnotation,
  TrafficProvider,
} from '../application/ports/traffic-provider';

@Injectable()
export class MockTrafficProvider implements TrafficProvider {
  async annotate(input: TrafficAnnotateInput): Promise<TrafficAnnotation> {
    const n = input.geometry.length;
    if (n < 2) {
      return {
        segments: [],
        advisories: [],
        durationInTrafficSeconds: input.baseDurationSeconds,
        source: 'mock',
      };
    }

    const heavyFrom = Math.floor(n * 0.22);
    const heavyTo = Math.max(heavyFrom + 1, Math.floor(n * 0.42));
    const blockedAt = Math.floor(n * 0.4);
    const isFastest = input.flavor === 'fastest';

    const segments: TrafficSegment[] = [];
    if (heavyFrom > 0) segments.push(seg(0, heavyFrom - 1, 'free'));
    segments.push(seg(heavyFrom, heavyTo, 'heavy'));

    const advisories: NavAdvisory[] = [];
    let blockedSpan = 0;
    if (isFastest && blockedAt >= heavyFrom && blockedAt <= heavyTo) {
      // Carve a short closure inside the heavy band on the fastest
      // line — the reason the recommendation flips to an alternative.
      const bFrom = blockedAt;
      const bTo = Math.min(heavyTo, blockedAt + 1);
      blockedSpan = bTo - bFrom + 1;
      // Re-express the heavy band around the closure.
      segments.pop();
      if (bFrom > heavyFrom) segments.push(seg(heavyFrom, bFrom - 1, 'heavy'));
      segments.push(seg(bFrom, bTo, 'blocked'));
      if (bTo < heavyTo) segments.push(seg(bTo + 1, heavyTo, 'heavy'));
      const at = input.geometry[blockedAt]!;
      advisories.push({
        kind: 'blockage',
        message: 'Road blocked ahead (incident). This route is not advised.',
        atLat: at.lat,
        atLng: at.lng,
      });
      advisories.push({
        kind: 'reroute',
        message: 'Take an alternative route — the scenic line avoids this closure.',
        atLat: at.lat,
        atLng: at.lng,
      });
    } else {
      advisories.push({
        kind: 'heavy_traffic',
        message: 'Heavy traffic on the middle stretch — expect delays.',
      });
      if (input.flavor === 'scenic') {
        advisories.push({
          kind: 'scenic_tip',
          message: 'Longer but more adventurous — fewer junctions, better views.',
        });
      }
    }
    if (heavyTo < n - 1) segments.push(seg(heavyTo + 1, n - 1, 'free'));

    const heavySpan = heavyTo - heavyFrom + 1;
    const penalty = (heavySpan / n) * 0.28 + (blockedSpan / Math.max(1, n)) * 0.65;
    const durationInTrafficSeconds = Math.round(input.baseDurationSeconds * (1 + penalty));

    return {
      segments: mergeAdjacent(segments),
      advisories,
      durationInTrafficSeconds,
      source: 'mock',
    };
  }
}

function seg(fromIndex: number, toIndex: number, level: TrafficLevel): TrafficSegment {
  return { fromIndex, toIndex, level };
}

/** Collapse runs of the same level so the client draws fewer
 *  sub-polylines. */
function mergeAdjacent(segs: readonly TrafficSegment[]): TrafficSegment[] {
  const sorted = [...segs]
    .filter((s) => s.toIndex >= s.fromIndex)
    .sort((a, b) => a.fromIndex - b.fromIndex);
  const out: TrafficSegment[] = [];
  for (const s of sorted) {
    const last = out[out.length - 1];
    if (last && last.level === s.level && s.fromIndex <= last.toIndex + 1) {
      out[out.length - 1] = {
        fromIndex: last.fromIndex,
        toIndex: Math.max(last.toIndex, s.toIndex),
        level: last.level,
      };
    } else {
      out.push(s);
    }
  }
  return out;
}
