/**
 * Admin moderation surface for crowd-sourced ScamReport rows.
 *
 *   GET    /api/v1/admin/safety/scam-reports          — list pending (default)
 *          ?verified=true                             — list verified pile instead
 *          ?limit=N                                   — cap at 200
 *   POST   /api/v1/admin/safety/scam-reports/:id/verify   — flip verified=true
 *   POST   /api/v1/admin/safety/scam-reports/:id/unverify — flip verified=false
 *   DELETE /api/v1/admin/safety/scam-reports/:id     — dismiss (hard delete)
 *
 * Class-level `@Roles('admin')` gates every method. The global
 * guard chain (rate-limit → JwtAuth → Roles) handles 401/403.
 *
 * Lives in the Safety module (not AdminModule) because it uses
 * Safety's repo directly — same model the Identity JWKS admin
 * surface uses. A future umbrella "admin" app-level module could
 * aggregate, but two tightly-scoped admin controllers read
 * cleaner than one multi-domain umbrella today.
 *
 * Installed by prompt [IV.18.11.5].
 */
import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { Roles } from '../../../common/auth';
import { DismissScamReportUseCase } from '../application/dismiss-scam-report.use-case';
import { ListScamReportsForModerationUseCase } from '../application/list-scam-reports-for-moderation.use-case';
import { VerifyScamReportUseCase } from '../application/verify-scam-report.use-case';
import type { ScamReport } from '../domain/scam-report.entity';

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

@Controller('admin/safety/scam-reports')
@Roles('admin')
export class AdminScamModerationController {
  constructor(
    private readonly listUc: ListScamReportsForModerationUseCase,
    private readonly verifyUc: VerifyScamReportUseCase,
    private readonly dismissUc: DismissScamReportUseCase,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async list(
    @Query('verified') verified?: string,
    @Query('limit') limit?: string,
  ): Promise<{ reports: ScamReportDto[] }> {
    const parsedLimit = limit ? Math.max(1, Math.min(200, Number(limit) || 50)) : undefined;
    // Query string: `verified=true` / `verified=false` / absent.
    // Anything else is treated as absent (default = pending).
    const parsedVerified = verified === 'true' ? true : verified === 'false' ? false : undefined;
    const rows = await this.listUc.execute({
      ...(parsedVerified !== undefined ? { verified: parsedVerified } : {}),
      ...(parsedLimit !== undefined ? { limit: parsedLimit } : {}),
    });
    return { reports: rows.map(toDto) };
  }

  @Post(':id/verify')
  @HttpCode(HttpStatus.OK)
  async verify(@Param('id') id: string): Promise<ScamReportDto> {
    const row = await this.verifyUc.execute({ id, verified: true });
    return toDto(row);
  }

  @Post(':id/unverify')
  @HttpCode(HttpStatus.OK)
  async unverify(@Param('id') id: string): Promise<ScamReportDto> {
    const row = await this.verifyUc.execute({ id, verified: false });
    return toDto(row);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async dismiss(@Param('id') id: string): Promise<void> {
    await this.dismissUc.execute(id);
  }
}
