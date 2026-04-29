/**
 * V.UX.23 — digital-nomad persona: per-country connectivity info
 * (avg mobile speed + SIM cost + best mobile carrier + power-plug
 * shape). Seeded editorially for v1; a future slice can swap the
 * repository for a real datasource (Speedtest Global Index, Numbeo).
 *
 * Surface mirrors `GetCountryPrimerUseCase` from V.UX.18 — public
 * GET keyed by ISO-3166-1 alpha-2 country code, 404 on unseeded
 * countries (vs. silently returning a default shape) so the UI can
 * surface a "no data yet" panel.
 *
 * Installed by prompt [V.UX.23].
 */
import { Injectable } from '@nestjs/common';
import { NotFoundError } from '@app/errors';

export interface ConnectivityInfo {
  readonly countryCode: string;
  readonly countryName: string;
  readonly avgMobileDownloadMbps: number;
  readonly avgFixedDownloadMbps: number;
  /** Average prepaid SIM cost for ~10 GB of data, in USD. */
  readonly simCostUsd10Gb: number;
  /** Best mobile carrier for travelers (editorial). */
  readonly bestCarrier: string;
  /** Power plug type letters per IEC ("A", "C", "G", etc.) — array since
   *  many countries take multiple. */
  readonly powerPlugs: readonly string[];
  /** ISO date the seed was last refreshed. */
  readonly seededAt: string;
}

const SEED: Readonly<Record<string, ConnectivityInfo>> = Object.freeze({
  pt: {
    countryCode: 'pt',
    countryName: 'Portugal',
    avgMobileDownloadMbps: 95,
    avgFixedDownloadMbps: 220,
    simCostUsd10Gb: 12,
    bestCarrier: 'MEO',
    powerPlugs: ['C', 'F'],
    seededAt: '2026-04-29',
  },
  th: {
    countryCode: 'th',
    countryName: 'Thailand',
    avgMobileDownloadMbps: 56,
    avgFixedDownloadMbps: 240,
    simCostUsd10Gb: 8,
    bestCarrier: 'AIS',
    powerPlugs: ['A', 'B', 'C', 'O'],
    seededAt: '2026-04-29',
  },
  mx: {
    countryCode: 'mx',
    countryName: 'Mexico',
    avgMobileDownloadMbps: 38,
    avgFixedDownloadMbps: 75,
    simCostUsd10Gb: 14,
    bestCarrier: 'Telcel',
    powerPlugs: ['A', 'B'],
    seededAt: '2026-04-29',
  },
  id: {
    countryCode: 'id',
    countryName: 'Indonesia',
    avgMobileDownloadMbps: 25,
    avgFixedDownloadMbps: 28,
    simCostUsd10Gb: 6,
    bestCarrier: 'Telkomsel',
    powerPlugs: ['C', 'F'],
    seededAt: '2026-04-29',
  },
  ge: {
    countryCode: 'ge',
    countryName: 'Georgia',
    avgMobileDownloadMbps: 48,
    avgFixedDownloadMbps: 35,
    simCostUsd10Gb: 7,
    bestCarrier: 'MagtiCom',
    powerPlugs: ['C', 'F'],
    seededAt: '2026-04-29',
  },
  vn: {
    countryCode: 'vn',
    countryName: 'Vietnam',
    avgMobileDownloadMbps: 42,
    avgFixedDownloadMbps: 95,
    simCostUsd10Gb: 5,
    bestCarrier: 'Viettel',
    powerPlugs: ['A', 'C', 'G'],
    seededAt: '2026-04-29',
  },
});

@Injectable()
export class GetConnectivityInfoUseCase {
  async execute(countryCode: string): Promise<ConnectivityInfo> {
    const key = countryCode.trim().toLowerCase();
    const row = SEED[key];
    if (!row) {
      throw new NotFoundError(
        'Connectivity info not available for this country yet',
        { countryCode: key },
        'CONNECTIVITY_INFO_NOT_FOUND',
      );
    }
    return row;
  }
}
