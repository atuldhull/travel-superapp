/**
 * Weather HTTP surface — single route for the v1 slice.
 *
 * Authenticated so the global rate limiter can key on `user.sub`
 * and prevent one client from burning the Open-Meteo quota.
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
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { GetForecastUseCase } from '../application/get-forecast.use-case';
import type { DailyForecast, WeatherForecast } from '../domain/weather-forecast.entity';
import { WeatherForecastQuerySchema, type WeatherForecastQuery } from './dto/weather.dto';
import { WeatherForecastResponseDto } from './dto/weather-response.dto';

interface WeatherForecastDto {
  readonly lat: number;
  readonly lng: number;
  readonly timezone: string;
  readonly days: readonly DailyForecast[];
}

function toDto(f: WeatherForecast): WeatherForecastDto {
  return { lat: f.lat, lng: f.lng, timezone: f.timezone, days: f.days };
}

@ApiTags('weather')
@ApiBearerAuth()
@Controller('weather')
export class WeatherController {
  constructor(private readonly getForecast: GetForecastUseCase) {}

  @ApiOperation({
    summary: 'Daily forecast for the given coordinates. Powered by Open-Meteo.',
  })
  @ApiResponse({ status: 200, description: 'Forecast bundle.', type: WeatherForecastResponseDto })
  @ApiResponse({ status: 422, description: 'INVALID_COORDINATES — lat/lng out of range.' })
  @ApiResponse({
    status: 502,
    description: 'WEATHER_PROVIDER_UNAVAILABLE — upstream fetch failed.',
  })
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
}
