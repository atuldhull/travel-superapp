/**
 * Plain-data domain types for the Weather module.
 *
 * `weatherCode` values follow the WMO weather interpretation codes
 * that Open-Meteo returns (0 = clear, 1–3 = mainly clear, 45/48 = fog,
 * 51/53/55 = drizzle, 61/63/65 = rain, 71/73/75 = snow, 95 = thunder).
 * We keep the raw code here — UI layers own the "icon + label" mapping
 * so new providers can be swapped in without a schema change.
 *
 * Installed by prompt [IV.18.5.1].
 */
export interface DailyForecast {
  /** ISO date in the forecast's local timezone, e.g. `2026-08-02`. */
  readonly date: string;
  readonly maxTempC: number;
  readonly minTempC: number;
  /** WMO weather code (see module doc). */
  readonly weatherCode: number;
  /** 0–100. Provider's own confidence; `null` if not reported. */
  readonly precipitationProbabilityPercent: number | null;
}

export interface WeatherForecast {
  readonly lat: number;
  readonly lng: number;
  /** IANA timezone string Open-Meteo resolved the coords to. */
  readonly timezone: string;
  readonly days: readonly DailyForecast[];
}
