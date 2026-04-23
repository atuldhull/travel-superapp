/**
 * Prisma + GeoQueries adapter for `ScamReportRepository`. Both
 * reads and writes go through `GeoQueries` so the PostGIS
 * `coordinates` column stays off Prisma's typed path
 * (CLAUDE rule 11).
 *
 * Installed by prompt [IV.18.11.1].
 */
import { Inject, Injectable } from '@nestjs/common';
import type {
  ScamReport as PrismaScamReport,
  ScamSeverity as PrismaScamSeverity,
} from '@prisma/client';
import {
  GeoQueries,
  type ScamReportWithDistance as GeoScamWithDistance,
} from '../../../common/db/geo-queries';
import type {
  ScamReport,
  ScamReportWithDistance,
  ScamSeverity,
} from '../domain/scam-report.entity';
import type {
  FindNearbyScamsInput,
  ReportScamInput,
  ScamReportRepository,
} from '../application/ports/scam-report.repository';

@Injectable()
export class PrismaScamReportRepository implements ScamReportRepository {
  constructor(@Inject(GeoQueries) private readonly geo: GeoQueries) {}

  async report(input: ReportScamInput): Promise<ScamReport> {
    const row = await this.geo.insertScamReport({
      reporterId: input.reporterId,
      category: input.category,
      severity: input.severity as PrismaScamSeverity,
      lat: input.lat,
      lng: input.lng,
      description: input.description,
      ...(input.evidenceUrls ? { evidenceUrls: input.evidenceUrls } : {}),
    });
    return toDomain(row);
  }

  async findNearby(input: FindNearbyScamsInput): Promise<readonly ScamReportWithDistance[]> {
    const rows = await this.geo.findScamReportsWithinRadius({
      lat: input.lat,
      lng: input.lng,
      radiusKm: input.radiusKm,
      ...(input.filters?.category || input.filters?.minSeverity
        ? {
            filters: {
              ...(input.filters.category ? { category: input.filters.category } : {}),
              ...(input.filters.minSeverity
                ? { minSeverity: input.filters.minSeverity as PrismaScamSeverity }
                : {}),
            },
          }
        : {}),
    });
    return rows.map(toDomainWithDistance);
  }
}

function toDomain(row: PrismaScamReport): ScamReport {
  return {
    id: row.id,
    reporterId: row.reporterId,
    category: row.category,
    severity: row.severity as ScamSeverity,
    description: row.description,
    evidenceUrls: row.evidenceUrls,
    verified: row.verified,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toDomainWithDistance(row: GeoScamWithDistance): ScamReportWithDistance {
  return {
    ...toDomain(row),
    distanceMeters: row.distanceMeters,
  };
}
