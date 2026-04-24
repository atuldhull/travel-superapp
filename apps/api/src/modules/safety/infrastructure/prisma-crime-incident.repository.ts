/**
 * GeoQueries-backed adapter for `CrimeIncidentRepository`. Reads
 * go through raw-SQL with PostGIS ST_DWithin (CLAUDE rule 11).
 *
 * Installed by prompt [IV.18.11.3].
 */
import { Inject, Injectable } from '@nestjs/common';
import type { ScamSeverity as PrismaScamSeverity } from '@prisma/client';
import {
  GeoQueries,
  type CrimeIncidentWithDistance as GeoCrimeWithDistance,
} from '../../../common/db/geo-queries';
import type { CrimeIncidentWithDistance, ScamSeverity } from '../domain/crime-incident.entity';
import type {
  CrimeIncidentRepository,
  FindNearbyCrimesInput,
} from '../application/ports/crime-incident.repository';

@Injectable()
export class PrismaCrimeIncidentRepository implements CrimeIncidentRepository {
  constructor(@Inject(GeoQueries) private readonly geo: GeoQueries) {}

  async findNearby(input: FindNearbyCrimesInput): Promise<readonly CrimeIncidentWithDistance[]> {
    const rows = await this.geo.findCrimeIncidentsWithinRadius({
      lat: input.lat,
      lng: input.lng,
      radiusKm: input.radiusKm,
      ...(input.filters?.category || input.filters?.minSeverity || input.filters?.since
        ? {
            filters: {
              ...(input.filters.category ? { category: input.filters.category } : {}),
              ...(input.filters.minSeverity
                ? { minSeverity: input.filters.minSeverity as PrismaScamSeverity }
                : {}),
              ...(input.filters.since ? { since: input.filters.since } : {}),
            },
          }
        : {}),
    });
    return rows.map(toDomain);
  }
}

function toDomain(row: GeoCrimeWithDistance): CrimeIncidentWithDistance {
  return {
    id: row.id,
    source: row.source,
    category: row.category,
    severity: row.severity as ScamSeverity,
    reportedAt: row.reportedAt,
    createdAt: row.createdAt,
    distanceMeters: row.distanceMeters,
  };
}
