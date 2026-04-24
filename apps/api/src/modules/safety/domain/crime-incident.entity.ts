/**
 * Plain-data `CrimeIncident` domain entity. Unlike `ScamReport`,
 * these rows come from external data sources (government crime
 * data, Numbeo, aggregated user reports) — there's no
 * user-facing write path, and no `reporterId`. `source` carries
 * the provenance tag so a future "show me only city-gov data"
 * filter has somewhere to key off.
 *
 * Installed by prompt [IV.18.11.3].
 */
import type { ScamSeverity } from './scam-report.entity';

export type { ScamSeverity };

export interface CrimeIncident {
  readonly id: string;
  readonly source: string;
  readonly category: string;
  readonly severity: ScamSeverity;
  readonly reportedAt: Date;
  readonly createdAt: Date;
}

export type CrimeIncidentWithDistance = CrimeIncident & { readonly distanceMeters: number };
