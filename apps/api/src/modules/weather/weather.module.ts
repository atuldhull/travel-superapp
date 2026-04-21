/**
 * Weather feature module. Clean-hex layering:
 *
 *   controller (interface)
 *     → GetForecastUseCase (application)
 *       → WEATHER_PROVIDER port (application)
 *         ← OpenMeteoWeatherProvider (infrastructure) via `fetch`
 *
 * Swappable provider: a paid / region-specific provider drops in as
 * a sibling class implementing `WeatherProvider`; just flip the
 * `useClass` on the provider token. Tests use
 * `overrideProvider(WEATHER_PROVIDER).useValue(...)` to stub the
 * HTTP boundary without monkey-patching `fetch`.
 *
 * Installed by prompt [IV.18.5.1].
 */
import { Module } from '@nestjs/common';
import { GetForecastUseCase } from './application/get-forecast.use-case';
import { WEATHER_PROVIDER } from './application/ports/weather-provider';
import { OpenMeteoWeatherProvider } from './infrastructure/open-meteo-provider';
import { WeatherController } from './interface/weather.controller';

@Module({
  controllers: [WeatherController],
  providers: [
    { provide: WEATHER_PROVIDER, useClass: OpenMeteoWeatherProvider },
    GetForecastUseCase,
  ],
  exports: [WEATHER_PROVIDER],
})
export class WeatherModule {}
