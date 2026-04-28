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
import { Module, forwardRef } from '@nestjs/common';
import { AccountModule } from '../account/account.module';
import { TripModule } from '../trip/trip.module';
import { AdminListSosEventsUseCase } from './application/admin-list-sos-events.use-case';
import { AdminResolveSosUseCase } from './application/admin-resolve-sos.use-case';
import { DismissScamReportUseCase } from './application/dismiss-scam-report.use-case';
import { FindNearbyCrimesUseCase } from './application/find-nearby-crimes.use-case';
import { FindNearbyScamsUseCase } from './application/find-nearby-scams.use-case';
import { GetCountryPrimerUseCase } from './application/get-country-primer.use-case';
import { GetSafetyScoreUseCase } from './application/get-safety-score.use-case';
import { ListMySosEventsUseCase } from './application/list-my-sos-events.use-case';
import { ListScamReportsForModerationUseCase } from './application/list-scam-reports-for-moderation.use-case';
import { MatchAgentForTripUseCase } from './application/match-agent-for-trip.use-case';
import { AGENT_REPOSITORY } from './application/ports/agent.repository';
import { CONTACT_NOTIFIER_PORT } from './application/ports/contact-notifier.port';
import { CRIME_INCIDENT_REPOSITORY } from './application/ports/crime-incident.repository';
import { SCAM_REPORT_REPOSITORY } from './application/ports/scam-report.repository';
import { SOS_EVENT_REPOSITORY } from './application/ports/sos-event.repository';
import { ReportScamUseCase } from './application/report-scam.use-case';
import { ResolveSosUseCase } from './application/resolve-sos.use-case';
import { TriggerSosUseCase } from './application/trigger-sos.use-case';
import { VerifyScamReportUseCase } from './application/verify-scam-report.use-case';
import { PrismaAgentRepository } from './infrastructure/prisma-agent.repository';
import { PrismaCrimeIncidentRepository } from './infrastructure/prisma-crime-incident.repository';
import { PrismaScamReportRepository } from './infrastructure/prisma-scam-report.repository';
import { PrismaSosEventRepository } from './infrastructure/prisma-sos-event.repository';
import { StubContactNotifierAdapter } from './infrastructure/stub-contact-notifier.adapter';
import { AdminScamModerationController } from './interface/admin-scam-moderation.controller';
import { AdminSosController } from './interface/admin-sos.controller';
import { AgentsController } from './interface/agents.controller';
import { CountryPrimerController } from './interface/country-primer.controller';
import { CrimeLayerController } from './interface/crime.controller';
import { SafetyScoreController } from './interface/safety-score.controller';
import { SafetyController } from './interface/safety.controller';
import { SosController } from './interface/sos.controller';

@Module({
  // V.UX.13 — pulls TRUSTED_CONTACT_REPOSITORY from AccountModule so
  // TriggerSosUseCase can fan out to the caller's pre-set contacts.
  // V.UX.17 — also pulls TRIP_REPOSITORY from TripModule so the
  // concierge match-for-trip use-case can owner-gate by trip.
  // forwardRef on TripModule because the cross-module wiring direction
  // already exists (TripModule consumes TRIP_MEDIA_PORT from MediaModule
  // which imports TripModule). Safety isn't in that loop today, but
  // forwardRef is the safe default for cross-module imports.
  imports: [AccountModule, forwardRef(() => TripModule)],
  controllers: [
    SafetyController,
    SosController,
    CrimeLayerController,
    SafetyScoreController,
    AdminScamModerationController,
    AdminSosController,
    AgentsController,
    CountryPrimerController,
  ],
  providers: [
    { provide: SCAM_REPORT_REPOSITORY, useClass: PrismaScamReportRepository },
    { provide: SOS_EVENT_REPOSITORY, useClass: PrismaSosEventRepository },
    { provide: CRIME_INCIDENT_REPOSITORY, useClass: PrismaCrimeIncidentRepository },
    { provide: AGENT_REPOSITORY, useClass: PrismaAgentRepository },
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
    MatchAgentForTripUseCase,
    GetCountryPrimerUseCase,
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
