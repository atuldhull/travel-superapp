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
import { PrismaService } from '../../../common/db/prisma.service';
import type {
  ScamReport,
  ScamReportWithDistance,
  ScamSeverity,
} from '../domain/scam-report.entity';
import type {
  FindNearbyScamsInput,
  ListForModerationInput,
  ReportScamInput,
  ScamReportRepository,
} from '../application/ports/scam-report.repository';

@Injectable()
export class PrismaScamReportRepository implements ScamReportRepository {
  constructor(
    @Inject(GeoQueries) private readonly geo: GeoQueries,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

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
    const hasFilters =
      input.filters !== undefined &&
      (input.filters.category !== undefined ||
        input.filters.minSeverity !== undefined ||
        input.filters.verified !== undefined);
    const rows = await this.geo.findScamReportsWithinRadius({
      lat: input.lat,
      lng: input.lng,
      radiusKm: input.radiusKm,
      ...(hasFilters
        ? {
            filters: {
              ...(input.filters?.category ? { category: input.filters.category } : {}),
              ...(input.filters?.minSeverity
                ? { minSeverity: input.filters.minSeverity as PrismaScamSeverity }
                : {}),
              ...(input.filters?.verified !== undefined
                ? { verified: input.filters.verified }
                : {}),
            },
          }
        : {}),
    });
    return rows.map(toDomainWithDistance);
  }

  async listForModeration(input: ListForModerationInput): Promise<readonly ScamReport[]> {
    // Prisma-typed read with explicit `select` that skips the
    // Unsupported `coordinates` column — moderation doesn't need
    // geo data; reviewing text + reporter is the whole job.
    const rows = await this.prisma.scamReport.findMany({
      where: input.verified === undefined ? { verified: false } : { verified: input.verified },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(input.limit, 1), 200),
      select: {
        id: true,
        reporterId: true,
        category: true,
        severity: true,
        description: true,
        evidenceUrls: true,
        verified: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return rows.map((r) => toDomain(r as PrismaScamReport));
  }

  async setVerified(id: string, verified: boolean): Promise<ScamReport | null> {
    // updateMany + count gate — same pattern every other admin /
    // owner-scoped mutation uses. Idempotent: re-setting to the
    // same value still returns count=1 in Postgres.
    const result = await this.prisma.scamReport.updateMany({
      where: { id },
      data: { verified },
    });
    if (result.count !== 1) return null;
    const row = await this.prisma.scamReport.findUnique({
      where: { id },
      select: {
        id: true,
        reporterId: true,
        category: true,
        severity: true,
        description: true,
        evidenceUrls: true,
        verified: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return row ? toDomain(row as PrismaScamReport) : null;
  }

  async deleteById(id: string): Promise<boolean> {
    // deleteMany not delete — delete runs findUniqueOrThrow first
    // and Prisma's typed path can't read the Unsupported
    // coordinates column. Same pattern PrismaPlaceRepository uses.
    const result = await this.prisma.scamReport.deleteMany({ where: { id } });
    return result.count === 1;
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
