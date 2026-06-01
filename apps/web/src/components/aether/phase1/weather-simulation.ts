/**
 * Atlas weather simulation — re-export from `@app/aether-canvas-shared`.
 *
 * Implementation moved to the shared package in AE457 so the Phase 4
 * native Atlas scene consumes identical seasonality math. This file
 * remains so existing imports keep working.
 */
export {
  simulatedWeatherFor,
  weatherForSlugMonth,
  weatherHasParticles,
  weatherStreakCount,
  weatherStreakIntensity,
  type MonthZeroIndexed,
  type WeatherState,
} from '@app/aether-canvas-shared';
