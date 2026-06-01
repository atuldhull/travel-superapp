/**
 * Atlas weather simulation — pure helpers (AE457).
 *
 * Moved from `apps/web/src/components/aether/phase1/weather-simulation.ts`
 * into the Phase 4 shared sub-package so web R3F + Phase 4 native R3F
 * use identical seasonality math (Indian monsoon belts + high-altitude
 * storm windows).
 *
 * AE388 doesn't pull real weather data (that needs an API + needs to
 * land later — AE395 wires Open-Meteo on web). Instead this file
 * simulates a plausible weather state from the trip's destination slug
 * + the trip's start month. The simulation matches India's actual
 * seasonality so demos feel grounded:
 *
 *   - Kerala / Alleppey: monsoon in Jun-Sep, otherwise clear
 *   - Goa / Anjuna: monsoon in Jun-Sep, otherwise clear
 *   - Leh / Ladakh: clear most months, storm at high altitude in Jul-Aug
 *   - Rajasthan / Jaipur: clear year-round (desert)
 *   - Default: 'clear'
 */
export type WeatherState = 'clear' | 'rain' | 'storm';

/** Month-set keys are 0-indexed (0 = January, 11 = December). */
export type MonthZeroIndexed = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

interface DestinationWeatherProfile {
  readonly rainMonths: ReadonlySet<MonthZeroIndexed>;
  readonly stormMonths: ReadonlySet<MonthZeroIndexed>;
}

const MONSOON_INDIA = new Set<MonthZeroIndexed>([5, 6, 7, 8]); // Jun..Sep
const HIGH_ALTITUDE_STORM = new Set<MonthZeroIndexed>([6, 7]); // Jul..Aug
const EMPTY_MONTHS = new Set<MonthZeroIndexed>();

const DESTINATION_WEATHER: Readonly<Record<string, DestinationWeatherProfile>> = Object.freeze({
  // Coastal monsoon belt — rain Jun..Sep.
  goa: { rainMonths: MONSOON_INDIA, stormMonths: EMPTY_MONTHS },
  anjuna: { rainMonths: MONSOON_INDIA, stormMonths: EMPTY_MONTHS },
  andaman: { rainMonths: MONSOON_INDIA, stormMonths: EMPTY_MONTHS },
  kerala: { rainMonths: MONSOON_INDIA, stormMonths: EMPTY_MONTHS },
  alleppey: { rainMonths: MONSOON_INDIA, stormMonths: EMPTY_MONTHS },
  // High altitude — clear most months, storm at peak summer.
  leh: { rainMonths: EMPTY_MONTHS, stormMonths: HIGH_ALTITUDE_STORM },
  ladakh: { rainMonths: EMPTY_MONTHS, stormMonths: HIGH_ALTITUDE_STORM },
  spiti: { rainMonths: EMPTY_MONTHS, stormMonths: HIGH_ALTITUDE_STORM },
  // Eastern tea belt — extended monsoon.
  darjeeling: {
    rainMonths: new Set<MonthZeroIndexed>([5, 6, 7, 8, 9]),
    stormMonths: EMPTY_MONTHS,
  },
  coorg: { rainMonths: MONSOON_INDIA, stormMonths: EMPTY_MONTHS },
  // North-plain monsoon.
  varanasi: { rainMonths: MONSOON_INDIA, stormMonths: EMPTY_MONTHS },
  // Desert — clear year-round.
  rajasthan: { rainMonths: EMPTY_MONTHS, stormMonths: EMPTY_MONTHS },
  jaipur: { rainMonths: EMPTY_MONTHS, stormMonths: EMPTY_MONTHS },
  // South-Indian Deccan — short monsoon.
  hampi: {
    rainMonths: new Set<MonthZeroIndexed>([6, 7, 8]),
    stormMonths: EMPTY_MONTHS,
  },
});

/** Pure: weather state for a destination slug + a given calendar month.
 *  Storm wins over rain. Unknown slug returns 'clear'. */
export function weatherForSlugMonth(
  slug: string | null | undefined,
  month: MonthZeroIndexed,
): WeatherState {
  if (typeof slug !== 'string' || slug === '') return 'clear';
  const profile = DESTINATION_WEATHER[slug.toLowerCase()];
  if (profile === undefined) return 'clear';
  if (profile.stormMonths.has(month)) return 'storm';
  if (profile.rainMonths.has(month)) return 'rain';
  return 'clear';
}

/** Convenience: weather state from a slug + a Date. */
export function simulatedWeatherFor(
  slug: string | null | undefined,
  at: Date | string | null | undefined,
): WeatherState {
  if (at === null || at === undefined || at === '') return 'clear';
  const date = at instanceof Date ? at : new Date(at);
  if (Number.isNaN(date.getTime())) return 'clear';
  const month = date.getMonth() as MonthZeroIndexed;
  return weatherForSlugMonth(slug, month);
}

/** True iff this weather state should render visible particles. */
export function weatherHasParticles(state: WeatherState): boolean {
  return state === 'rain' || state === 'storm';
}

/** Intensity multiplier for WeatherStreaks — 1.0 for rain, 1.6 for storm,
 *  0 (caller should not mount the streaks) for clear. */
export function weatherStreakIntensity(state: WeatherState): number {
  switch (state) {
    case 'clear':
      return 0;
    case 'rain':
      return 1;
    case 'storm':
      return 1.6;
  }
}

/** Particle count to pass to WeatherStreaks for this state. Tuned so
 *  rain looks like a steady shower (~400) and storm reads as denser
 *  (~700) without melting low-end GPUs. */
export function weatherStreakCount(state: WeatherState): number {
  switch (state) {
    case 'clear':
      return 0;
    case 'rain':
      return 400;
    case 'storm':
      return 700;
  }
}
