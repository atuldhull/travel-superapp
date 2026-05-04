/**
 * V.UX.35 — local emergency-services lookup. Returns the police +
 * ambulance + fire numbers for a given country code. Editorial
 * seed of ~50 countries covering the high-traffic travel corridors.
 *
 * Public endpoint (no auth) so a user mid-emergency doesn't have
 * to be signed in to see their local 911. Case-insensitive
 * country code.
 *
 * Numbers use the conventional shape (no `+`, no spaces) so the
 * web `tel:` link can prefix `+` when the country code is known
 * — the page renders the human form too.
 *
 * Installed by prompt [V.UX.35].
 */
import { Injectable } from '@nestjs/common';
import { NotFoundError } from '@app/errors';

export interface LocalEmergencyInfo {
  readonly countryCode: string;
  readonly countryName: string;
  /** Single short-number for everything (US 911, EU 112). */
  readonly universal: string | null;
  readonly police: string;
  readonly ambulance: string;
  readonly fire: string;
  /** Free-text note shown in the UI ("dial 112 anywhere in EU even
   *  with no SIM"; "in mountain areas, also try 100 for rescue"). */
  readonly note: string | null;
}

const SEED: ReadonlyMap<string, LocalEmergencyInfo> = new Map(
  (
    [
      [
        'US',
        {
          countryName: 'United States',
          universal: '911',
          police: '911',
          ambulance: '911',
          fire: '911',
          note: null,
        },
      ],
      [
        'CA',
        {
          countryName: 'Canada',
          universal: '911',
          police: '911',
          ambulance: '911',
          fire: '911',
          note: null,
        },
      ],
      [
        'MX',
        {
          countryName: 'Mexico',
          universal: '911',
          police: '911',
          ambulance: '911',
          fire: '911',
          note: null,
        },
      ],
      [
        'GB',
        {
          countryName: 'United Kingdom',
          universal: '999',
          police: '999',
          ambulance: '999',
          fire: '999',
          note: '112 also works.',
        },
      ],
      [
        'IE',
        {
          countryName: 'Ireland',
          universal: '112',
          police: '112',
          ambulance: '112',
          fire: '112',
          note: '999 also works.',
        },
      ],
      [
        'FR',
        {
          countryName: 'France',
          universal: '112',
          police: '17',
          ambulance: '15',
          fire: '18',
          note: null,
        },
      ],
      [
        'DE',
        {
          countryName: 'Germany',
          universal: '112',
          police: '110',
          ambulance: '112',
          fire: '112',
          note: null,
        },
      ],
      [
        'ES',
        {
          countryName: 'Spain',
          universal: '112',
          police: '091',
          ambulance: '061',
          fire: '080',
          note: null,
        },
      ],
      [
        'IT',
        {
          countryName: 'Italy',
          universal: '112',
          police: '113',
          ambulance: '118',
          fire: '115',
          note: null,
        },
      ],
      [
        'PT',
        {
          countryName: 'Portugal',
          universal: '112',
          police: '112',
          ambulance: '112',
          fire: '112',
          note: null,
        },
      ],
      [
        'NL',
        {
          countryName: 'Netherlands',
          universal: '112',
          police: '0900-8844',
          ambulance: '112',
          fire: '112',
          note: null,
        },
      ],
      [
        'BE',
        {
          countryName: 'Belgium',
          universal: '112',
          police: '101',
          ambulance: '112',
          fire: '112',
          note: null,
        },
      ],
      [
        'CH',
        {
          countryName: 'Switzerland',
          universal: '112',
          police: '117',
          ambulance: '144',
          fire: '118',
          note: 'Mountain rescue: 1414.',
        },
      ],
      [
        'AT',
        {
          countryName: 'Austria',
          universal: '112',
          police: '133',
          ambulance: '144',
          fire: '122',
          note: null,
        },
      ],
      [
        'SE',
        {
          countryName: 'Sweden',
          universal: '112',
          police: '112',
          ambulance: '112',
          fire: '112',
          note: null,
        },
      ],
      [
        'NO',
        {
          countryName: 'Norway',
          universal: '112',
          police: '112',
          ambulance: '113',
          fire: '110',
          note: null,
        },
      ],
      [
        'DK',
        {
          countryName: 'Denmark',
          universal: '112',
          police: '114',
          ambulance: '112',
          fire: '112',
          note: null,
        },
      ],
      [
        'FI',
        {
          countryName: 'Finland',
          universal: '112',
          police: '112',
          ambulance: '112',
          fire: '112',
          note: null,
        },
      ],
      [
        'IS',
        {
          countryName: 'Iceland',
          universal: '112',
          police: '112',
          ambulance: '112',
          fire: '112',
          note: null,
        },
      ],
      [
        'PL',
        {
          countryName: 'Poland',
          universal: '112',
          police: '997',
          ambulance: '999',
          fire: '998',
          note: null,
        },
      ],
      [
        'CZ',
        {
          countryName: 'Czechia',
          universal: '112',
          police: '158',
          ambulance: '155',
          fire: '150',
          note: null,
        },
      ],
      [
        'HU',
        {
          countryName: 'Hungary',
          universal: '112',
          police: '107',
          ambulance: '104',
          fire: '105',
          note: null,
        },
      ],
      [
        'GR',
        {
          countryName: 'Greece',
          universal: '112',
          police: '100',
          ambulance: '166',
          fire: '199',
          note: null,
        },
      ],
      [
        'TR',
        {
          countryName: 'Turkey',
          universal: '112',
          police: '155',
          ambulance: '112',
          fire: '110',
          note: null,
        },
      ],
      [
        'RO',
        {
          countryName: 'Romania',
          universal: '112',
          police: '112',
          ambulance: '112',
          fire: '112',
          note: null,
        },
      ],
      [
        'BG',
        {
          countryName: 'Bulgaria',
          universal: '112',
          police: '166',
          ambulance: '150',
          fire: '160',
          note: null,
        },
      ],
      [
        'HR',
        {
          countryName: 'Croatia',
          universal: '112',
          police: '192',
          ambulance: '194',
          fire: '193',
          note: null,
        },
      ],
      [
        'GE',
        {
          countryName: 'Georgia',
          universal: '112',
          police: '112',
          ambulance: '112',
          fire: '112',
          note: null,
        },
      ],
      [
        'RU',
        {
          countryName: 'Russia',
          universal: '112',
          police: '102',
          ambulance: '103',
          fire: '101',
          note: null,
        },
      ],
      [
        'UA',
        {
          countryName: 'Ukraine',
          universal: '112',
          police: '102',
          ambulance: '103',
          fire: '101',
          note: null,
        },
      ],
      [
        'IL',
        {
          countryName: 'Israel',
          universal: null,
          police: '100',
          ambulance: '101',
          fire: '102',
          note: null,
        },
      ],
      [
        'AE',
        {
          countryName: 'United Arab Emirates',
          universal: '999',
          police: '999',
          ambulance: '998',
          fire: '997',
          note: null,
        },
      ],
      [
        'SA',
        {
          countryName: 'Saudi Arabia',
          universal: '911',
          police: '999',
          ambulance: '997',
          fire: '998',
          note: null,
        },
      ],
      [
        'EG',
        {
          countryName: 'Egypt',
          universal: null,
          police: '122',
          ambulance: '123',
          fire: '180',
          note: 'Tourist police: 126.',
        },
      ],
      [
        'MA',
        {
          countryName: 'Morocco',
          universal: '112',
          police: '19',
          ambulance: '15',
          fire: '15',
          note: null,
        },
      ],
      [
        'ZA',
        {
          countryName: 'South Africa',
          universal: '112',
          police: '10111',
          ambulance: '10177',
          fire: '10177',
          note: null,
        },
      ],
      [
        'KE',
        {
          countryName: 'Kenya',
          universal: '999',
          police: '999',
          ambulance: '999',
          fire: '999',
          note: '112 also works.',
        },
      ],
      [
        'NG',
        {
          countryName: 'Nigeria',
          universal: '112',
          police: '112',
          ambulance: '112',
          fire: '112',
          note: null,
        },
      ],
      [
        'IN',
        {
          countryName: 'India',
          universal: '112',
          police: '100',
          ambulance: '102',
          fire: '101',
          note: null,
        },
      ],
      [
        'NP',
        {
          countryName: 'Nepal',
          universal: null,
          police: '100',
          ambulance: '102',
          fire: '101',
          note: null,
        },
      ],
      [
        'LK',
        {
          countryName: 'Sri Lanka',
          universal: '119',
          police: '119',
          ambulance: '110',
          fire: '110',
          note: null,
        },
      ],
      [
        'TH',
        {
          countryName: 'Thailand',
          universal: '191',
          police: '191',
          ambulance: '1669',
          fire: '199',
          note: 'Tourist police: 1155.',
        },
      ],
      [
        'VN',
        {
          countryName: 'Vietnam',
          universal: null,
          police: '113',
          ambulance: '115',
          fire: '114',
          note: null,
        },
      ],
      [
        'ID',
        {
          countryName: 'Indonesia',
          universal: '112',
          police: '110',
          ambulance: '118',
          fire: '113',
          note: null,
        },
      ],
      [
        'MY',
        {
          countryName: 'Malaysia',
          universal: '999',
          police: '999',
          ambulance: '999',
          fire: '994',
          note: null,
        },
      ],
      [
        'SG',
        {
          countryName: 'Singapore',
          universal: null,
          police: '999',
          ambulance: '995',
          fire: '995',
          note: null,
        },
      ],
      [
        'PH',
        {
          countryName: 'Philippines',
          universal: '911',
          police: '911',
          ambulance: '911',
          fire: '911',
          note: null,
        },
      ],
      [
        'JP',
        {
          countryName: 'Japan',
          universal: null,
          police: '110',
          ambulance: '119',
          fire: '119',
          note: null,
        },
      ],
      [
        'KR',
        {
          countryName: 'South Korea',
          universal: null,
          police: '112',
          ambulance: '119',
          fire: '119',
          note: null,
        },
      ],
      [
        'CN',
        {
          countryName: 'China',
          universal: null,
          police: '110',
          ambulance: '120',
          fire: '119',
          note: null,
        },
      ],
      [
        'TW',
        {
          countryName: 'Taiwan',
          universal: null,
          police: '110',
          ambulance: '119',
          fire: '119',
          note: null,
        },
      ],
      [
        'HK',
        {
          countryName: 'Hong Kong',
          universal: '999',
          police: '999',
          ambulance: '999',
          fire: '999',
          note: null,
        },
      ],
      [
        'AU',
        {
          countryName: 'Australia',
          universal: '000',
          police: '000',
          ambulance: '000',
          fire: '000',
          note: '112 from mobile also works.',
        },
      ],
      [
        'NZ',
        {
          countryName: 'New Zealand',
          universal: '111',
          police: '111',
          ambulance: '111',
          fire: '111',
          note: null,
        },
      ],
      [
        'BR',
        {
          countryName: 'Brazil',
          universal: null,
          police: '190',
          ambulance: '192',
          fire: '193',
          note: null,
        },
      ],
      [
        'AR',
        {
          countryName: 'Argentina',
          universal: '911',
          police: '911',
          ambulance: '107',
          fire: '100',
          note: null,
        },
      ],
      [
        'CL',
        {
          countryName: 'Chile',
          universal: null,
          police: '133',
          ambulance: '131',
          fire: '132',
          note: null,
        },
      ],
      [
        'PE',
        {
          countryName: 'Peru',
          universal: '105',
          police: '105',
          ambulance: '106',
          fire: '116',
          note: null,
        },
      ],
      [
        'CO',
        {
          countryName: 'Colombia',
          universal: '123',
          police: '123',
          ambulance: '123',
          fire: '123',
          note: null,
        },
      ],
    ] as const
  ).map(([code, data]) => [code, { countryCode: code, ...data }]),
);

@Injectable()
export class GetLocalEmergencyUseCase {
  execute(countryCode: string): LocalEmergencyInfo {
    const code = countryCode.trim().toUpperCase();
    const info = SEED.get(code);
    if (!info) {
      throw new NotFoundError(
        `No emergency-number seed for country: ${code}`,
        { countryCode: code },
        'EMERGENCY_INFO_NOT_FOUND',
      );
    }
    return info;
  }
}
