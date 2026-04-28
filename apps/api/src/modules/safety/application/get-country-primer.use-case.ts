/**
 * V.UX.18 — return the static editorial primer for a destination
 * country. Six seeded countries cover the persona's typical
 * first-international destinations. Unknown country code → 404
 * `COUNTRY_PRIMER_NOT_FOUND`.
 *
 * Real data sources (govt visa APIs, IATA, local-language
 * dictionaries) land in a future slice; the static seed keeps
 * the demo end-to-end working without external integrations.
 *
 * Installed by prompt [V.UX.18].
 */
import { Injectable } from '@nestjs/common';
import { NotFoundError } from '@app/errors';
import type { CountryPrimer } from '../domain/country-primer.entity';

const SEEDED_AT = new Date('2026-04-28T00:00:00.000Z');

const PRIMERS: ReadonlyMap<string, CountryPrimer> = new Map([
  [
    'th',
    {
      countryCode: 'th',
      countryName: 'Thailand',
      visaInfo:
        'Most Western passports get a 30-day visa exemption on arrival (60 days for some). E-visa available for longer stays. Carry proof of onward travel + accommodation. Source: thaievisa.go.th.',
      topScamCategories: [
        'fake-taxi',
        'overcharge',
        'gem-scam',
        'tuk-tuk-detour',
        'jet-ski-deposit',
      ],
      emergencyNumbers: [
        { label: 'Tourist Police', number: '1155' },
        { label: 'Police', number: '191' },
        { label: 'Ambulance', number: '1669' },
      ],
      languagePhrases: [
        { translation: 'สวัสดี (sawatdee)', english: 'Hello' },
        { translation: 'ขอบคุณ (khob khun)', english: 'Thank you' },
        { translation: 'เท่าไหร่ (tao rai)', english: 'How much?' },
        { translation: 'ไม่ (mai)', english: 'No' },
      ],
      seededAt: SEEDED_AT,
    },
  ],
  [
    'jp',
    {
      countryCode: 'jp',
      countryName: 'Japan',
      visaInfo:
        '90-day visa-free entry for most Western passports. Bring a printed accommodation address — immigration may ask. Source: mofa.go.jp.',
      topScamCategories: ['izakaya-bait', 'host-club-bottle', 'taxi-airport-flatfee'],
      emergencyNumbers: [
        { label: 'Police', number: '110' },
        { label: 'Ambulance / Fire', number: '119' },
        { label: 'Japan Helpline', number: '0570-000-911' },
      ],
      languagePhrases: [
        { translation: 'こんにちは (konnichiwa)', english: 'Hello' },
        { translation: 'ありがとう (arigatou)', english: 'Thank you' },
        { translation: 'すみません (sumimasen)', english: 'Excuse me / sorry' },
        { translation: 'いくらですか (ikura desu ka)', english: 'How much is it?' },
      ],
      seededAt: SEEDED_AT,
    },
  ],
  [
    'in',
    {
      countryCode: 'in',
      countryName: 'India',
      visaInfo:
        'e-Visa is the fast path for tourists from 160+ countries. Apply 4 days before travel via indianvisaonline.gov.in. Some travellers need a paper visa — check before booking.',
      topScamCategories: [
        'fake-government-office',
        'gem-scam',
        'auto-rickshaw-overcharge',
        'fake-train-tickets',
      ],
      emergencyNumbers: [
        { label: 'All-emergency', number: '112' },
        { label: 'Police', number: '100' },
        { label: 'Ambulance', number: '108' },
      ],
      languagePhrases: [
        { translation: 'नमस्ते (namaste)', english: 'Hello' },
        { translation: 'धन्यवाद (dhanyavaad)', english: 'Thank you' },
        { translation: 'कितना (kitna)', english: 'How much?' },
        { translation: 'नहीं (nahin)', english: 'No' },
      ],
      seededAt: SEEDED_AT,
    },
  ],
  [
    'fr',
    {
      countryCode: 'fr',
      countryName: 'France',
      visaInfo:
        'Schengen visa rules apply. Most Western passports: 90-day visa-free entry per 180-day rolling window. ETIAS pre-authorisation expected to roll out — check europa.eu.',
      topScamCategories: [
        'petition-distraction',
        'pickpocket-metro',
        'taxi-overcharge',
        'bracelet-scam',
      ],
      emergencyNumbers: [
        { label: 'EU emergency', number: '112' },
        { label: 'Police', number: '17' },
        { label: 'Medical', number: '15' },
      ],
      languagePhrases: [
        { translation: 'Bonjour', english: 'Hello' },
        { translation: 'Merci', english: 'Thank you' },
        { translation: 'Combien ça coûte ?', english: 'How much does it cost?' },
        { translation: 'Excusez-moi', english: 'Excuse me' },
      ],
      seededAt: SEEDED_AT,
    },
  ],
  [
    'mx',
    {
      countryCode: 'mx',
      countryName: 'Mexico',
      visaInfo:
        'Most Western passports get up to 180 days visa-free on arrival. The FMM tourist card was paper-only for years — entry is now mostly stamp-based. Carry proof of onward travel.',
      topScamCategories: [
        'fake-police-shakedown',
        'taxi-overcharge',
        'atm-skimmer',
        'timeshare-pitch',
      ],
      emergencyNumbers: [
        { label: 'All-emergency', number: '911' },
        { label: 'Tourist Assistance', number: '078' },
      ],
      languagePhrases: [
        { translation: 'Hola', english: 'Hello' },
        { translation: 'Gracias', english: 'Thank you' },
        { translation: '¿Cuánto cuesta?', english: 'How much does it cost?' },
        { translation: 'No, gracias', english: 'No, thank you' },
      ],
      seededAt: SEEDED_AT,
    },
  ],
  [
    'us',
    {
      countryCode: 'us',
      countryName: 'United States',
      visaInfo:
        'ESTA pre-authorisation for VWP passports (UK, EU, JP, AU, NZ, KR, …). Otherwise a B-1/B-2 visa. Always carry your I-94 record after entry.',
      topScamCategories: ['rideshare-overcharge', 'tipping-confusion', 'state-tax-surprise'],
      emergencyNumbers: [
        { label: 'All-emergency', number: '911' },
        { label: 'Non-emergency police', number: '311' },
      ],
      languagePhrases: [
        { translation: 'Hello', english: 'Hello' },
        { translation: 'Thank you', english: 'Thank you' },
        { translation: 'How much is it?', english: 'How much is it?' },
        { translation: "Where's the bathroom?", english: "Where's the bathroom?" },
      ],
      seededAt: SEEDED_AT,
    },
  ],
]);

@Injectable()
export class GetCountryPrimerUseCase {
  async execute(countryCode: string): Promise<CountryPrimer> {
    const code = countryCode.trim().toLowerCase();
    const primer = PRIMERS.get(code);
    if (!primer) {
      throw new NotFoundError(
        `Country primer not found: ${code}`,
        { countryCode: code },
        'COUNTRY_PRIMER_NOT_FOUND',
      );
    }
    return primer;
  }

  /** Test-only — list seeded country codes. */
  static seededCountries(): readonly string[] {
    return [...PRIMERS.keys()];
  }
}
