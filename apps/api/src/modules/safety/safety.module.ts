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
import { AccountModule } from '../account/account.module';
import { AdminListSosEventsUseCase } from './application/admin-list-sos-events.use-case';
import { AdminResolveSosUseCase } from './application/admin-resolve-sos.use-case';
import { DismissScamReportUseCase } from './application/dismiss-scam-report.use-case';
import { FindNearbyCrimesUseCase } from './application/find-nearby-crimes.use-case';
import { FindNearbyScamsUseCase } from './application/find-nearby-scams.use-case';
import { GetSafetyScoreUseCase } from './application/get-safety-score.use-case';
import { ListMySosEventsUseCase } from './application/list-my-sos-events.use-case';
import { ListScamReportsForModerationUseCase } from './application/list-scam-reports-for-moderation.use-case';
import { CONTACT_NOTIFIER_PORT } from './application/ports/contact-notifier.port';
import { CRIME_INCIDENT_REPOSITORY } from './application/ports/crime-incident.repository';
import { SCAM_REPORT_REPOSITORY } from './application/ports/scam-report.repository';
import { SOS_EVENT_REPOSITORY } from './application/ports/sos-event.repository';
import { ReportScamUseCase } from './application/report-scam.use-case';
import { ResolveSosUseCase } from './application/resolve-sos.use-case';
import { TriggerSosUseCase } from './application/trigger-sos.use-case';
import { VerifyScamReportUseCase } from './application/verify-scam-report.use-case';
import { PrismaCrimeIncidentRepository } from './infrastructure/prisma-crime-incident.repository';
import { PrismaScamReportRepository } from './infrastructure/prisma-scam-report.repository';
import { PrismaSosEventRepository } from './infrastructure/prisma-sos-event.repository';
import { StubContactNotifierAdapter } from './infrastructure/stub-contact-notifier.adapter';
import { AdminScamModerationController } from './interface/admin-scam-moderation.controller';
import { AdminSosController } from './interface/admin-sos.controller';
import { CrimeLayerController } from './interface/crime.controller';
import { SafetyScoreController } from './interface/safety-score.controller';
import { SafetyController } from './interface/safety.controller';
import { SosController } from './interface/sos.controller';

@Module({
  // V.UX.13 — pulls TRUSTED_CONTACT_REPOSITORY from AccountModule so
  // TriggerSosUseCase can fan out to the caller's pre-set contacts.
  imports: [AccountModule],
  controllers: [
    SafetyController,
    SosController,
    CrimeLayerController,
    SafetyScoreController,
    AdminScamModerationController,
    AdminSosController,
  ],
  providers: [
    { provide: SCAM_REPORT_REPOSITORY, useClass: PrismaScamReportRepository },
    { provide: SOS_EVENT_REPOSITORY, useClass: PrismaSosEventRepository },
    { provide: CRIME_INCIDENT_REPOSITORY, useClass: PrismaCrimeIncidentRepository },
    // V.UX.13 — stub SMS adapter; real Twilio swaps via the same
    // port without touching the SOS use-case. Bound twice so e2e
    // tests can resolve the concrete class to drain the ring.
    StubContactNotifierAdapter,
    { provide: CONTACT_NOTIFIER_PORT, useExisting: StubContactNotifierAdapter },
    ReportScamUseCase,
    FindNearbyScamsUseCase,
    TriggerSosUseCase,
    ListMySosEventsUseCase,
    ResolveSosUseCase,
    FindNearbyCrimesUseCase,
    GetSafetyScoreUseCase,
    ListScamReportsForModerationUseCase,
    VerifyScamReportUseCase,
    DismissScamReportUseCase,
    AdminListSosEventsUseCase,
    AdminResolveSosUseCase,
  ],
  exports: [
    SCAM_REPORT_REPOSITORY,
    SOS_EVENT_REPOSITORY,
    CRIME_INCIDENT_REPOSITORY,
    GetSafetyScoreUseCase,
    StubContactNotifierAdapter,
  ],
})
export class SafetyModule {}
