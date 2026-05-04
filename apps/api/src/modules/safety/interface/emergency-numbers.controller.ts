/**
 * V.UX.35 — local emergency-services HTTP surface.
 *
 *   GET /api/v1/safety/emergency-numbers/:countryCode
 *     200 → LocalEmergencyResponseDto
 *     404 → EMERGENCY_INFO_NOT_FOUND
 *
 * `@Public()` — a user mid-emergency must NOT have to be signed
 * in to read their local 911. Same posture as the country-primer
 * lookup. ~50 countries seeded; expand by adding rows to
 * `get-local-emergency.use-case.ts`.
 *
 * Installed by prompt [V.UX.35].
 */
import { Controller, Get, HttpCode, HttpStatus, Param } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiProperty, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../common/auth';
import {
  GetLocalEmergencyUseCase,
  type LocalEmergencyInfo,
} from '../application/get-local-emergency.use-case';

class LocalEmergencyResponseDto {
  @ApiProperty({ description: 'ISO 3166-1 alpha-2 country code.' })
  declare countryCode: string;

  @ApiProperty()
  declare countryName: string;

  @ApiProperty({
    nullable: true,
    description: 'Universal short code (US 911, EU 112). Null when none.',
  })
  declare universal: string | null;

  @ApiProperty()
  declare police: string;

  @ApiProperty()
  declare ambulance: string;

  @ApiProperty()
  declare fire: string;

  @ApiProperty({ nullable: true })
  declare note: string | null;
}

@ApiTags('safety')
@Controller('safety/emergency-numbers')
export class EmergencyNumbersController {
  constructor(private readonly getUc: GetLocalEmergencyUseCase) {}

  @ApiOperation({
    summary:
      'V.UX.35 — local police / ambulance / fire numbers for a country (~50 seeded). Public — sign-in not required mid-emergency.',
  })
  @ApiParam({ name: 'countryCode', description: 'ISO 3166-1 alpha-2 (case-insensitive).' })
  @ApiResponse({
    status: 200,
    description: 'Numbers + optional note.',
    type: LocalEmergencyResponseDto,
  })
  @ApiResponse({ status: 404, description: 'EMERGENCY_INFO_NOT_FOUND.' })
  @Public()
  @Get(':countryCode')
  @HttpCode(HttpStatus.OK)
  get(@Param('countryCode') countryCode: string): LocalEmergencyInfo {
    return this.getUc.execute(countryCode);
  }
}
