/**
 * V.UX.18 — first-time-international primer for a destination.
 * Aggregates the four data points that pain-point the persona:
 * visa basics, common scams, local emergency numbers, and a few
 * survival phrases. v1 is editorially seeded (six countries);
 * future slices can swap individual fields for live sources.
 *
 * Installed by prompt [V.UX.18].
 */
export interface CountryPrimer {
  /** ISO 3166-1 alpha-2, lowercase. */
  readonly countryCode: string;
  readonly countryName: string;
  readonly visaInfo: string;
  /** Most prevalent scam categories tourists report. */
  readonly topScamCategories: readonly string[];
  readonly emergencyNumbers: readonly EmergencyNumber[];
  readonly languagePhrases: readonly LanguagePhrase[];
  /** Editorial-only flag — true when v1 hardcoded the row. */
  readonly seededAt: Date;
}

export interface EmergencyNumber {
  readonly label: string;
  readonly number: string;
}

export interface LanguagePhrase {
  readonly translation: string;
  readonly english: string;
}
