/**
 * POST.2A.3 — weather signal source.
 *
 * REUSES the existing WEATHER_PROVIDER port (Open-Meteo, free, no
 * key) — deliberately NOT a new HTTP client (verified facts). Maps a
 * daily forecast → a provider-neutral SignalSnapshot the pure
 * EvaluateSignalsUseCase can threshold.
 *
 * LAW 2: only the trip's lat/lng leave the system (the weather port
 * takes nothing else) — no user PII.
 *
 * Installed by prompt [POST.2A.3].
 */
import { Inject, Injectable } from '@nestjs/common';
import { createLogger, type AppLogger } from '@app/logger';
import {
  WEATHER_PROVIDER,
  type WeatherProvider,
} from '../../weather/application/ports/weather-provider';
import type {
  SignalSnapshot,
  SignalSource,
  SignalSourceQuery,
} from '../application/ports/signal-source.port';

const FORECAST_DAYS = 7;

@Injectable()
export class WeatherSignalAdapter implements SignalSource {
  private readonly logger: AppLogger = createLogger('agent.signal.weather');

  constructor(@Inject(WEATHER_PROVIDER) private readonly weather: WeatherProvider) {}

  async snapshot(query: SignalSourceQuery): Promise<SignalSnapshot> {
    try {
      const fc = await this.weather.getDailyForecast({
        lat: query.lat,
        lng: query.lng,
        days: FORECAST_DAYS,
      });
      let maxProb: number | null = null;
      let worstDay: string | null = null;
      for (const d of fc.days) {
        const p = d.precipitationProbabilityPercent;
        if (p !== null && (maxProb === null || p > maxProb)) {
          maxProb = p;
          worstDay = d.date;
        }
      }
      return {
        kind: 'weather',
        observedAt: new Date(),
        data: Object.freeze({
          maxPrecipProbabilityPercent: maxProb,
          worstDay,
        }),
      };
    } catch (err) {
      // Degrade to a deterministic "nothing observed" snapshot — the
      // loop must never fail because an upstream is down (LAW 1).
      this.logger.warn(
        { err: err instanceof Error ? err.message : String(err) },
        'weather_signal_degraded',
      );
      return {
        kind: 'weather',
        observedAt: new Date(0),
        data: Object.freeze({ maxPrecipProbabilityPercent: null, worstDay: null }),
      };
    }
  }
}
