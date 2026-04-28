/**
 * V.UX.18 — country-primer HTTP surface.
 *
 *   GET /api/v1/safety/country-primer/:countryCode
 *     200 → CountryPrimerDto
 *     404 → COUNTRY_PRIMER_NOT_FOUND
 *
 * Authenticated so the rate-limit guard can key on user. Future
 * slices may flip this `@Public()` once we're confident the
 * primer set is stable + cacheable.
 *
 * Installed by prompt [V.UX.18].
 */
import { Controller, Get, HttpCode, HttpStatus, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GetCountryPrimerUseCase } from '../application/get-country-primer.use-case';
import type { CountryPrimer } from '../domain/country-primer.entity';
import { CountryPrimerDto } from './dto/country-primer.dto';

interface CountryPrimerOutDto {
  readonly countryCode: string;
  readonly countryName: string;
  readonly visaInfo: string;
  readonly topScamCategories: readonly string[];
  readonly emergencyNumbers: readonly { label: string; number: string }[];
  readonly languagePhrases: readonly { translation: string; english: string }[];
  readonly seededAt: string;
}

function toDto(p: CountryPrimer): CountryPrimerOutDto {
  return {
    countryCode: p.countryCode,
    countryName: p.countryName,
    visaInfo: p.visaInfo,
    topScamCategories: p.topScamCategories,
    emergencyNumbers: p.emergencyNumbers.map((e) => ({ label: e.label, number: e.number })),
    languagePhrases: p.languagePhrases.map((l) => ({
      translation: l.translation,
      english: l.english,
    })),
    seededAt: p.seededAt.toISOString(),
  };
}

@ApiTags('safety')
@ApiBearerAuth()
@Controller('safety/country-primer')
export class CountryPrimerController {
  constructor(private readonly getUc: GetCountryPrimerUseCase) {}

  @ApiOperation({
    summary:
      'Editorial first-time-international primer for a destination — visa info, top scams, emergency numbers, survival phrases.',
  })
  @ApiParam({ name: 'countryCode', description: 'ISO 3166-1 alpha-2 code (case-insensitive).' })
  @ApiResponse({ status: 200, description: 'Primer.', type: CountryPrimerDto })
  @ApiResponse({ status: 404, description: 'COUNTRY_PRIMER_NOT_FOUND.' })
  @Get(':countryCode')
  @HttpCode(HttpStatus.OK)
  async get(@Param('countryCode') countryCode: string): Promise<CountryPrimerOutDto> {
    const primer = await this.getUc.execute(countryCode);
    return toDto(primer);
  }
}
