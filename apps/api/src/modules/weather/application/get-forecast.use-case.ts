/**
 * Fetch a daily weather forecast for a coordinate + horizon. Thin
 * shell over the `WEATHER_PROVIDER` port — the business logic is
 * input validation + clamp. Caching lands in a follow-up slice
 * (`WeatherForecast` table + Redis short-TTL memo); keep this
 * use-case stateless for now so the cache layer can drop in
 * without a call-site change.
 *
 * Installed by prompt [IV.18.5.1].
 */
import { Inject, Injectable } from '@nestjs/common';
import { ValidationError } from '@app/errors';
import type { WeatherForecast } from '../domain/weather-forecast.entity';
import { WEATHER_PROVIDER, type WeatherProvider } from './ports/weather-provider';

export interface GetForecastCommand {
  readonly lat: number;
  readonly lng: number;
  readonly days?: number;
}

const DEFAULT_DAYS = 7;
const MAX_DAYS = 16;

@Injectable()
export class GetForecastUseCase {
  constructor(@Inject(WEATHER_PROVIDER) private readonly provider: WeatherProvider) {}

  async execute(cmd: GetForecastCommand): Promise<WeatherForecast> {
    if (!Number.isFinite(cmd.lat) || cmd.lat < -90 || cmd.lat > 90) {
      throw new ValidationError(
        'Latitude out of range',
        { lat: ['must be between -90 and 90'] },
        { lat: cmd.lat },
        'INVALID_COORDINATES',
      );
    }
    if (!Number.isFinite(cmd.lng) || cmd.lng < -180 || cmd.lng > 180) {
      throw new ValidationError(
        'Longitude out of range',
        { lng: ['must be between -180 and 180'] },
        { lng: cmd.lng },
        'INVALID_COORDINATES',
      );
    }
    const days =
      cmd.days === undefined ? DEFAULT_DAYS : Math.max(1, Math.min(MAX_DAYS, Math.floor(cmd.days)));

    return this.provider.getDailyForecast({ lat: cmd.lat, lng: cmd.lng, days });
  }
}
