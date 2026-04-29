/**
 * V.UX.23 — class-based response DTO for `GET /connectivity/:countryCode`.
 * Documentation-only; the use-case returns a frozen plain object that
 * structurally matches.
 *
 * Installed by prompt [V.UX.23].
 */
import { ApiProperty } from '@nestjs/swagger';

export class ConnectivityInfoDto {
  @ApiProperty({ description: 'ISO-3166-1 alpha-2 lowercase.' })
  declare countryCode: string;

  @ApiProperty()
  declare countryName: string;

  @ApiProperty({ description: 'Average mobile download speed in Mbps.' })
  declare avgMobileDownloadMbps: number;

  @ApiProperty({ description: 'Average fixed-line download speed in Mbps.' })
  declare avgFixedDownloadMbps: number;

  @ApiProperty({ description: 'Approx prepaid SIM cost for ~10 GB of data, USD.' })
  declare simCostUsd10Gb: number;

  @ApiProperty({ description: 'Best mobile carrier for travelers (editorial pick).' })
  declare bestCarrier: string;

  @ApiProperty({
    type: [String],
    description: 'IEC plug-type letters in use (e.g. ["A","B"], ["C","F"]).',
  })
  declare powerPlugs: string[];

  @ApiProperty({ format: 'date', description: 'ISO date the seed was last refreshed.' })
  declare seededAt: string;
}
