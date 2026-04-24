/**
 * Safety HTTP surface. v1 exposes the crowd-sourced scam-report
 * feature (playbook moat). Crime layer + SOS events land in
 * follow-up slices.
 *
 *   POST /api/v1/safety/scam-reports          — authenticated user reports
 *   POST /api/v1/safety/scam-reports/search   — nearby scams
 *
 * `search` is POST (not GET) because the body has coord + filters;
 * mirrors the pattern the other search endpoints follow.
 *
 * Installed by prompt [IV.18.11.1].
 */
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { type AuthenticatedUser, CurrentUser } from '../../../common/auth';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { FindNearbyScamsUseCase } from '../application/find-nearby-scams.use-case';
import { ReportScamUseCase } from '../application/report-scam.use-case';
import type { ScamReport, ScamReportWithDistance } from '../domain/scam-report.entity';
import {
  FindNearbyScamsBodySchema,
  ReportScamBodySchema,
  type FindNearbyScamsBody,
  type ReportScamBody,
} from './dto/safety.dto';

interface ScamReportDto {
  readonly id: string;
  readonly reporterId: string;
  readonly category: string;
  readonly severity: string;
  readonly description: string;
  readonly evidenceUrls: readonly string[];
  readonly verified: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

interface ScamReportWithDistanceDto extends ScamReportDto {
  readonly distanceMeters: number;
}

function toDto(r: ScamReport): ScamReportDto {
  return {
    id: r.id,
    reporterId: r.reporterId,
    category: r.category,
    severity: r.severity,
    description: r.description,
    evidenceUrls: r.evidenceUrls,
    verified: r.verified,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

function toDistanceDto(r: ScamReportWithDistance): ScamReportWithDistanceDto {
  return { ...toDto(r), distanceMeters: r.distanceMeters };
}

@Controller('safety/scam-reports')
export class SafetyController {
  constructor(
    private readonly reportUc: ReportScamUseCase,
    private readonly findUc: FindNearbyScamsUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async report(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(ReportScamBodySchema)) body: ReportScamBody,
  ): Promise<ScamReportDto> {
    const report = await this.reportUc.execute({
      reporterId: user.sub,
      category: body.category,
      severity: body.severity,
      lat: body.center.lat,
      lng: body.center.lng,
      description: body.description,
      ...(body.evidenceUrls ? { evidenceUrls: body.evidenceUrls } : {}),
    });
    return toDto(report);
  }

  @Post('search')
  @HttpCode(HttpStatus.OK)
  async search(
    @Body(new ZodValidationPipe(FindNearbyScamsBodySchema)) body: FindNearbyScamsBody,
  ): Promise<{ reports: readonly ScamReportWithDistanceDto[] }> {
    const reports = await this.findUc.execute({
      lat: body.center.lat,
      lng: body.center.lng,
      radiusKm: body.radiusKm,
      ...(body.category ? { category: body.category } : {}),
      ...(body.minSeverity ? { minSeverity: body.minSeverity } : {}),
      ...(body.verifiedOnly ? { verifiedOnly: body.verifiedOnly } : {}),
      ...(body.limit !== undefined ? { limit: body.limit } : {}),
    });
    return { reports: reports.map(toDistanceDto) };
  }
}
