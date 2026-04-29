/**
 * V.UX.23 — connectivity-info HTTP surface for the digital-nomad
 * persona. Public read; the seeded dataset has no PII and is not
 * user-scoped.
 *
 *   GET /api/v1/connectivity/:countryCode
 *     200 → ConnectivityInfoDto
 *     404 → CONNECTIVITY_INFO_NOT_FOUND
 *
 * Lives in account because it complements the nomadMode toggle and
 * the account module already groups traveler-info surfaces. Tagged
 * `account` so the SDK barrel keeps a single home for the related
 * hooks.
 *
 * Installed by prompt [V.UX.23].
 */
import { Controller, Get, HttpCode, HttpStatus, Param } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../common/auth';
import {
  GetConnectivityInfoUseCase,
  type ConnectivityInfo,
} from '../application/get-connectivity-info.use-case';
import { ConnectivityInfoDto } from './dto/connectivity-response.dto';

@ApiTags('account')
@Controller('connectivity')
export class ConnectivityController {
  constructor(private readonly getInfo: GetConnectivityInfoUseCase) {}

  @ApiOperation({
    summary:
      'Per-country connectivity info (mobile + fixed avg speeds, SIM cost, best carrier, power plugs). Public; seeded editorially.',
  })
  @ApiParam({
    name: 'countryCode',
    description: 'ISO-3166-1 alpha-2 country code, case-insensitive (e.g. "pt", "th").',
  })
  @ApiResponse({
    status: 200,
    description: 'Connectivity info for the country.',
    type: ConnectivityInfoDto,
  })
  @ApiResponse({
    status: 404,
    description: 'CONNECTIVITY_INFO_NOT_FOUND — country not in the editorial seed yet.',
  })
  @Public()
  @Get(':countryCode')
  @HttpCode(HttpStatus.OK)
  async byCountry(@Param('countryCode') countryCode: string): Promise<ConnectivityInfo> {
    return this.getInfo.execute(countryCode);
  }
}
