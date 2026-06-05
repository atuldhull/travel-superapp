/**
 * Weather HTTP surface — single route for the v1 slice.
 *
 * Public (no auth): weather is a browsable, marketing-tier surface
 * (same posture as the @Public near-me composite, which itself fans
 * out to this provider). The global rate-limiter keys on the caller's
 * IP for anonymous requests, which keeps the Open-Meteo quota safe.
 *
 *   GET /api/v1/weather/forecast?lat=&lng=&days=
 *     200 → { lat, lng, timezone, days: [{ date, maxTempC, minTempC,
 *              weatherCode, precipitationProbabilityPercent }] }
 *     422 → INVALID_COORDINATES  (lat/lng out of range)
 *     502 → WEATHER_PROVIDER_UNAVAILABLE  (upstream fetch failed)
 *
 * Installed by prompt [IV.18.5.1].
 */
import { Controller, Get, HttpCode, HttpStatus, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../common/auth';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { GetForecastUseCase } from '../application/get-forecast.use-case';
import { GetHourlyForecastUseCase } from '../application/get-hourly-forecast.use-case';
import type {
  DailyForecast,
  HourlyForecast,
  HourlyWeatherForecast,
  WeatherForecast,
} from '../domain/weather-forecast.entity';
import {
  HourlyWeatherForecastQuerySchema,
  WeatherForecastQuerySchema,
  type HourlyWeatherForecastQuery,
  type WeatherForecastQuery,
} from './dto/weather.dto';
import {
  HourlyWeatherForecastResponseDto,
  WeatherForecastResponseDto,
} from './dto/weather-response.dto';

interface WeatherForecastDto {
  readonly lat: number;
  readonly lng: number;
  readonly timezone: string;
  readonly days: readonly DailyForecast[];
}

function toDto(f: WeatherForecast): WeatherForecastDto {
  return { lat: f.lat, lng: f.lng, timezone: f.timezone, days: f.days };
}

interface HourlyWeatherForecastDto {
  readonly lat: number;
  readonly lng: number;
  readonly timezone: string;
  readonly hours: readonly HourlyForecast[];
}

function toHourlyDto(f: HourlyWeatherForecast): HourlyWeatherForecastDto {
  return { lat: f.lat, lng: f.lng, timezone: f.timezone, hours: f.hours };
}

@ApiTags('weather')
@Controller('weather')
export class WeatherController {
  constructor(
    private readonly getForecast: GetForecastUseCase,
    private readonly getHourly: GetHourlyForecastUseCase,
  ) {}

  @ApiOperation({
    summary: 'Daily forecast for the given coordinates. Powered by Open-Meteo.',
  })
  @ApiResponse({ status: 200, description: 'Forecast bundle.', type: WeatherForecastResponseDto })
  @ApiResponse({ status: 422, description: 'INVALID_COORDINATES — lat/lng out of range.' })
  @ApiResponse({
    status: 502,
    description: 'WEATHER_PROVIDER_UNAVAILABLE — upstream fetch failed.',
  })
  @Public()
  @Get('forecast')
  @HttpCode(HttpStatus.OK)
  async forecast(
    // Arg-scoped — the standard [IV.18.2.5.fix] pattern. `new
    // ZodValidationPipe` on a @Query arg doesn't run against @Param
    // (we don't have one here, but the habit is worth keeping).
    @Query(new ZodValidationPipe(WeatherForecastQuerySchema)) query: WeatherForecastQuery,
  ): Promise<WeatherForecastDto> {
    const forecast = await this.getForecast.execute({
      lat: query.lat,
      lng: query.lng,
      ...(query.days !== undefined ? { days: query.days } : {}),
    });
    return toDto(forecast);
  }

  /**
   * V.UX.21 — hourly forecast for the adventure persona. Powers
   * the "today's adventure window" widget on the trip page (best
   * 2hr slot in the next 24h). 1..48h horizon, 24h default.
   */
  @ApiOperation({
    summary:
      'Hourly forecast (precip + wind + temp) for the next 1..48 hours. Powers the adventure-window widget.',
  })
  @ApiResponse({
    status: 200,
    description: 'Hourly forecast bundle.',
    type: HourlyWeatherForecastResponseDto,
  })
  @ApiResponse({ status: 422, description: 'INVALID_COORDINATES — lat/lng out of range.' })
  @ApiResponse({
    status: 502,
    description: 'WEATHER_PROVIDER_UNAVAILABLE — upstream fetch failed.',
  })
  @Public()
  @Get('forecast/hourly')
  @HttpCode(HttpStatus.OK)
  async hourly(
    @Query(new ZodValidationPipe(HourlyWeatherForecastQuerySchema))
    query: HourlyWeatherForecastQuery,
  ): Promise<HourlyWeatherForecastDto> {
    const forecast = await this.getHourly.execute({
      lat: query.lat,
      lng: query.lng,
      ...(query.hours !== undefined ? { hours: query.hours } : {}),
    });
    return toHourlyDto(forecast);
  }
}
