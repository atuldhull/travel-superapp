/**
 * Class-based response DTOs for the Weather HTTP surface.
 * Documentation-only.
 *
 * Installed by prompt [IV.18.19.61].
 */
import { ApiProperty } from '@nestjs/swagger';

export class DailyForecastDto {
  @ApiProperty({ description: 'ISO date in the forecast timezone, e.g. 2026-08-02.' })
  declare date: string;

  @ApiProperty({ description: 'High temperature in °C.' })
  declare maxTempC: number;

  @ApiProperty({ description: 'Low temperature in °C.' })
  declare minTempC: number;

  @ApiProperty({
    description:
      'WMO weather code (0=clear, 1-3=mainly clear, 45/48=fog, 51/53/55=drizzle, 61/63/65=rain, 71/73/75=snow, 95=thunder).',
  })
  declare weatherCode: number;

  @ApiProperty({
    nullable: true,
    description: 'Provider precipitation confidence 0..100, or null if not reported.',
  })
  declare precipitationProbabilityPercent: number | null;
}

export class WeatherForecastResponseDto {
  @ApiProperty()
  declare lat: number;

  @ApiProperty()
  declare lng: number;

  @ApiProperty({ description: 'IANA timezone string Open-Meteo resolved the coords to.' })
  declare timezone: string;

  @ApiProperty({ type: [DailyForecastDto] })
  declare days: DailyForecastDto[];
}

export class HourlyForecastDto {
  @ApiProperty({ description: 'ISO timestamp in the forecast timezone.' })
  declare time: string;

  @ApiProperty({ description: 'Temperature in °C.' })
  declare tempC: number;

  @ApiProperty({
    nullable: true,
    description: 'Provider precipitation confidence 0..100, or null if not reported.',
  })
  declare precipitationProbabilityPercent: number | null;

  @ApiProperty({ nullable: true, description: 'Wind speed at 10m, km/h.' })
  declare windSpeedKmh: number | null;

  @ApiProperty({ description: 'WMO weather code.' })
  declare weatherCode: number;
}

export class HourlyWeatherForecastResponseDto {
  @ApiProperty()
  declare lat: number;

  @ApiProperty()
  declare lng: number;

  @ApiProperty({ description: 'IANA timezone string Open-Meteo resolved the coords to.' })
  declare timezone: string;

  @ApiProperty({ type: [HourlyForecastDto] })
  declare hours: HourlyForecastDto[];
}
