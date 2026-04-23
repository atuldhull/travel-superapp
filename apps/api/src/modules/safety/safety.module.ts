/**
 * Safety feature module. v1 is just scam reports:
 *
 *   controller (interface)
 *     → ReportScamUseCase / FindNearbyScamsUseCase (application)
 *       → SCAM_REPORT_REPOSITORY port
 *         ← PrismaScamReportRepository (infrastructure)
 *             delegates to GeoQueries raw-SQL for PostGIS coordinates.
 *
 * `GeoQueries` is provided by the global `DbModule` — no import here.
 *
 * Crime layer + SOS events + agent marketplace land in follow-up
 * slices. Each adds its own ports + use-cases inside this module.
 *
 * Installed by prompt [IV.18.11.1].
 */
import { Module } from '@nestjs/common';
import { FindNearbyScamsUseCase } from './application/find-nearby-scams.use-case';
import { SCAM_REPORT_REPOSITORY } from './application/ports/scam-report.repository';
import { ReportScamUseCase } from './application/report-scam.use-case';
import { PrismaScamReportRepository } from './infrastructure/prisma-scam-report.repository';
import { SafetyController } from './interface/safety.controller';

@Module({
  controllers: [SafetyController],
  providers: [
    { provide: SCAM_REPORT_REPOSITORY, useClass: PrismaScamReportRepository },
    ReportScamUseCase,
    FindNearbyScamsUseCase,
  ],
  exports: [SCAM_REPORT_REPOSITORY],
})
export class SafetyModule {}
