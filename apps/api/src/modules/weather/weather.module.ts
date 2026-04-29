/**
 * Weather feature module. Clean-hex layering + decorated provider:
 *
 *   controller (interface)
 *     → GetForecastUseCase (application)
 *       → WEATHER_PROVIDER port (application)
 *         ← CachedWeatherProvider (infrastructure)
 *             ├── OpenMeteoWeatherProvider (real HTTP fetch)
 *             └── WEATHER_CACHE port → RedisWeatherCache (infra)
 *
 * The cache decorator lives at the provider level (not the use-case
 * level) so any future caller of `WEATHER_PROVIDER` — including
 * Trip-weather fold-ins — inherits caching without knowing about it.
 * Tests override `WEATHER_PROVIDER` directly, which bypasses both
 * decorator and cache (exactly the right seam for testing trip ×
 * weather cross-module wiring without Redis-in-test complexity).
 *
 * Installed by prompt [IV.18.5.1]; cache decorator added by
 * prompt [IV.18.5.2].
 */
import { Module } from '@nestjs/common';
import { GetForecastUseCase } from './application/get-forecast.use-case';
import { GetHourlyForecastUseCase } from './application/get-hourly-forecast.use-case';
import { WEATHER_CACHE } from './application/ports/weather-cache';
import { WEATHER_PROVIDER } from './application/ports/weather-provider';
import { CachedWeatherProvider } from './infrastructure/cached-weather-provider';
import { OpenMeteoWeatherProvider } from './infrastructure/open-meteo-provider';
import { RedisWeatherCache } from './infrastructure/redis-weather-cache';
import { WeatherController } from './interface/weather.controller';

@Module({
  controllers: [WeatherController],
  providers: [
    // Raw upstream — registered as a class so the decorator can
    // @Inject it by type (not via the WEATHER_PROVIDER token,
    // otherwise we'd circularly resolve ourselves).
    OpenMeteoWeatherProvider,
    { provide: WEATHER_CACHE, useClass: RedisWeatherCache },
    // WEATHER_PROVIDER token points at the decorator so every caller
    // of the port gets caching for free.
    { provide: WEATHER_PROVIDER, useClass: CachedWeatherProvider },
    GetForecastUseCase,
    GetHourlyForecastUseCase,
  ],
  exports: [WEATHER_PROVIDER, GetForecastUseCase, GetHourlyForecastUseCase],
})
export class WeatherModule {}
