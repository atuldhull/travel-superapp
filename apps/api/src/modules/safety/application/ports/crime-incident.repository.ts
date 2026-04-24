/**
 * Port for CrimeIncident read access. Intentionally read-only —
 * the write path is a seed script / future ingest worker, neither
 * of which is a user-facing HTTP route in v1.
 *
 * Installed by prompt [IV.18.11.3].
 */
import type { CrimeIncidentWithDistance, ScamSeverity } from '../../domain/crime-incident.entity';

export interface FindNearbyCrimesInput {
  readonly lat: number;
  readonly lng: number;
  readonly radiusKm: number;
  readonly filters?: {
    readonly category?: string;
    readonly minSeverity?: ScamSeverity;
    readonly since?: Date;
  };
}

export interface CrimeIncidentRepository {
  findNearby(input: FindNearbyCrimesInput): Promise<readonly CrimeIncidentWithDistance[]>;
}

export const CRIME_INCIDENT_REPOSITORY = Symbol('CrimeIncidentRepository');
