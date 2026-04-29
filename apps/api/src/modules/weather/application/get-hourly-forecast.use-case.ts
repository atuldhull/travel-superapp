/**
 * V.UX.21 — fetch an hourly weather forecast for the adventure /
 * outdoor persona. Same input-validation shape as the daily
 * use-case, but the horizon is in hours (1..48) rather than days.
 *
 * 48 is the practical ceiling for the adventure-window UX — beyond
 * 48h, hourly precip + wind are noise. Open-Meteo can return up to
 * 16 days of hourly data; the use-case clamps below that on
 * purpose.
 *
 * Installed by prompt [V.UX.21].
 */
import { Inject, Injectable } from '@nestjs/common';
import { ValidationError } from '@app/errors';
import type { HourlyWeatherForecast } from '../domain/weather-forecast.entity';
import { WEATHER_PROVIDER, type WeatherProvider } from './ports/weather-provider';

export interface GetHourlyForecastCommand {
  readonly lat: number;
  readonly lng: number;
  readonly hours?: number;
}

const DEFAULT_HOURS = 24;
const MAX_HOURS = 48;

@Injectable()
export class GetHourlyForecastUseCase {
  constructor(@Inject(WEATHER_PROVIDER) private readonly provider: WeatherProvider) {}

  async execute(cmd: GetHourlyForecastCommand): Promise<HourlyWeatherForecast> {
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
    const hours =
      cmd.hours === undefined
        ? DEFAULT_HOURS
        : Math.max(1, Math.min(MAX_HOURS, Math.floor(cmd.hours)));

    return this.provider.getHourlyForecast({ lat: cmd.lat, lng: cmd.lng, hours });
  }
}
