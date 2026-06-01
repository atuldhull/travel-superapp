/**
 * Drift Now Card content derivation — pure helpers (AE457).
 *
 * Moved from `apps/web/src/components/aether/phase1/now-card-content.ts`
 * into the Phase 4 shared sub-package so web + native Drift render
 * identical Now Card text for the same time of day.
 *
 * Per docs/aether/02-surfaces.md §1 Drift, the Now Card shows "what to
 * do RIGHT NOW based on time/place/persona". AE385 ships the time-of-day
 * spine: a small headline (Morning / Afternoon / Evening / Night), a
 * suggestion line, and a single verb that the card surfaces as its CTA.
 *
 * Pure — no React, no DOM. The Drift shell calls this with `new Date()`
 * and renders the result.
 *
 * Phase 2+ will layer in:
 *   - User's first upcoming trip ("Sketch day 1 of your Leh trip")
 *   - Persona-aware suggestions ("Quiet morning — sketch a walking route")
 *   - Real time-zone awareness (currently uses the client's local clock)
 */
export type TimeBand = 'morning' | 'afternoon' | 'evening' | 'night';

export interface NowCardContent {
  /** Plain-English time band — used as the card's eyebrow heading. */
  readonly band: TimeBand;
  /** Capitalised label used in the card chrome (Morning / Afternoon / …). */
  readonly headline: string;
  /** One-sentence prompt encouraging the user to engage. */
  readonly suggestion: string;
  /** Single verb the card surfaces as the CTA pill (Plan / Refine / Reflect / Dream). */
  readonly verb: string;
}

/** Map a 0..23 hour to its band. Boundaries are tuned to feel natural
 *  rather than astronomical — `morning` covers 5am-11:59am so an early
 *  riser still gets the "Plan" prompt; `night` swallows 21:00 onward so
 *  late-evening planning falls into "Dream" rather than "Reflect". */
export function timeBandFor(hour: number): TimeBand {
  const h = Number.isFinite(hour) ? Math.floor(hour) : 0;
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 21) return 'evening';
  return 'night';
}

const BAND_CONTENT: Readonly<Record<TimeBand, Omit<NowCardContent, 'band'>>> = Object.freeze({
  morning: {
    headline: 'Morning',
    suggestion: 'Sketch the day ahead.',
    verb: 'Plan',
  },
  afternoon: {
    headline: 'Afternoon',
    suggestion: 'Refine your plan.',
    verb: 'Refine',
  },
  evening: {
    headline: 'Evening',
    suggestion: 'Reflect on today.',
    verb: 'Reflect',
  },
  night: {
    headline: 'Night',
    suggestion: 'Dream of where next.',
    verb: 'Dream',
  },
});

/** Resolve the full Now Card content for a given moment. Accepts any
 *  `Date` so tests + Storybook can pin a fixed time. */
export function nowCardContent(at: Date | number): NowCardContent {
  const date = at instanceof Date ? at : new Date(at);
  const hour = Number.isFinite(date.getHours()) ? date.getHours() : 0;
  const band = timeBandFor(hour);
  const fields = BAND_CONTENT[band];
  return { band, headline: fields.headline, suggestion: fields.suggestion, verb: fields.verb };
}

/** Convenience: same as `nowCardContent(new Date())`. Centralises the
 *  default-clock entry point so tests can monkey-patch one helper instead
 *  of every call site. */
export function nowCardContentNow(): NowCardContent {
  return nowCardContent(new Date());
}
