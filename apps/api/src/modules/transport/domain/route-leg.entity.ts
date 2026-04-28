/**
 * Plain-data domain types for the Transport module.
 *
 * `TransportMode` values match the Prisma `TransportMode` enum so a
 * future "save my route" slice can persist `RouteLeg` rows without
 * type coercion. Not every provider supports every mode — adapters
 * may omit modes from their response; the use-case surfaces that as
 * "no option for this mode" rather than 404.
 *
 * `estimatedCostUsd` is a flat-USD estimate the provider derives
 * (walk: null, transit: base fare, car/rideshare: distance × rate,
 * etc.). Clients format currency client-side.
 *
 * Installed by prompt [IV.18.10.1].
 */
export type TransportMode =
  | 'walk'
  | 'public_transit'
  | 'bicycle'
  | 'two_wheeler'
  | 'car'
  | 'taxi'
  | 'rideshare';

export interface RouteLeg {
  readonly mode: TransportMode;
  readonly distanceMeters: number;
  readonly durationSeconds: number;
  readonly estimatedCostUsd: number | null;
  /** Provider-reported confidence: real providers tell you whether
   *  traffic data was available + fresh; mock always returns 'high'. */
  readonly confidence: 'high' | 'medium' | 'low';
  /**
   * V.UX.15 — true iff this leg is step-free (wheelchair / stroller
   * accessible end-to-end). Mock provider derives it deterministically:
   * `walk` and `public_transit` are NOT step-free by default (stairs
   * at stations); `bicycle`, `two_wheeler`, `car`, `taxi`,
   * `rideshare` are. Real adapters can source this from accessibility
   * metadata (station equipment, sidewalk grade, etc.).
   */
  readonly stepFree: boolean;
}
