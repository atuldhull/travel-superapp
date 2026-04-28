/**
 * V.UX.18 — class-based response DTOs for the country-primer
 * surface. Documentation-only.
 *
 * Installed by prompt [V.UX.18].
 */
import { ApiProperty } from '@nestjs/swagger';

export class EmergencyNumberDto {
  @ApiProperty()
  declare label: string;

  @ApiProperty()
  declare number: string;
}

export class LanguagePhraseDto {
  @ApiProperty({ description: 'Phrase in the destination language.' })
  declare translation: string;

  @ApiProperty({ description: 'English meaning.' })
  declare english: string;
}

export class CountryPrimerDto {
  @ApiProperty({ description: 'ISO 3166-1 alpha-2, lowercase.' })
  declare countryCode: string;

  @ApiProperty()
  declare countryName: string;

  @ApiProperty()
  declare visaInfo: string;

  @ApiProperty({ type: [String], description: 'Most prevalent scam categories.' })
  declare topScamCategories: string[];

  @ApiProperty({ type: [EmergencyNumberDto] })
  declare emergencyNumbers: EmergencyNumberDto[];

  @ApiProperty({ type: [LanguagePhraseDto] })
  declare languagePhrases: LanguagePhraseDto[];

  @ApiProperty({ format: 'date-time', description: 'When the editorial seed was last refreshed.' })
  declare seededAt: string;
}
