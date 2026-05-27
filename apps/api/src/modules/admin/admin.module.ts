/**
 * Admin feature module. Clean-hex DI:
 *
 *   controller (interface)
 *     → use-cases (application)
 *       → PLACE_REPOSITORY port (imported from PlacesModule)
 *
 * Admin owns no domain of its own — it's a thin authz shell around
 * Place curation. V.UX.36 grows the module: it now owns the
 * `AdminAuditLog` aggregate (entity + port + adapter + list
 * use-case + read-only HTTP surface). The audit log is a
 * cross-cutting concern, so this module is `@Global()` — every
 * other module that has admin verbs (account/safety/trip/media)
 * can `@Inject(ADMIN_AUDIT_LOG_REPOSITORY)` without an `imports:`
 * line.
 *
 * Installed by prompt [IV.18.3.1]; @Global + audit log added by
 * [V.UX.36].
 */
import { Global, Module } from '@nestjs/common';
import { PlacesModule } from '../places/places.module';
import { AdminCreatePlaceUseCase } from './application/admin-create-place.use-case';
import { AdminDeletePlaceUseCase } from './application/admin-delete-place.use-case';
import { AdminListAuditLogsUseCase } from './application/admin-list-audit-logs.use-case';
import { GetPublicMetricsUseCase } from './application/get-public-metrics.use-case';
import { GetRetentionStatsUseCase } from './application/get-retention-stats.use-case';
import { ListTakedownsUseCase } from './application/list-takedowns.use-case';
import { ADMIN_AUDIT_LOG_REPOSITORY } from './application/ports/admin-audit-log.repository';
import { COMPLIANCE_QUERIES_PORT } from './application/ports/compliance-queries.port';
import { SLACK_ADMIN_NOTIFIER } from './application/ports/slack-admin-notifier.port';
import { PrismaAdminAuditLogRepository } from './infrastructure/prisma-admin-audit-log.repository';
import { PrismaComplianceQueries } from './infrastructure/prisma-compliance-queries';
import { SlackAdminNotifierAdapter } from './infrastructure/slack-admin-notifier.adapter';
import { AdminAuditLogsController } from './interface/admin-audit-logs.controller';
import { AdminController } from './interface/admin.controller';
import { ComplianceController } from './interface/compliance.controller';
import { PublicMetricsController } from './interface/public-metrics.controller';

@Global()
@Module({
  // Import PlacesModule so the use-cases can inject PLACE_REPOSITORY.
  imports: [PlacesModule],
  controllers: [
    AdminController,
    AdminAuditLogsController,
    ComplianceController,
    PublicMetricsController,
  ],
  providers: [
    AdminCreatePlaceUseCase,
    AdminDeletePlaceUseCase,
    AdminListAuditLogsUseCase,
    GetRetentionStatsUseCase,
    ListTakedownsUseCase,
    GetPublicMetricsUseCase,
    { provide: ADMIN_AUDIT_LOG_REPOSITORY, useClass: PrismaAdminAuditLogRepository },
    { provide: COMPLIANCE_QUERIES_PORT, useClass: PrismaComplianceQueries },
    // [S-E6] Slack webhook notifier — swallows errors, only fires for
    // critical action types, no-op when SLACK_ADMIN_WEBHOOK_URL is unset.
    { provide: SLACK_ADMIN_NOTIFIER, useClass: SlackAdminNotifierAdapter },
  ],
  // V.UX.36 — exported via @Global so cross-module admin use-cases
  // can record audit rows without module wiring churn.
  exports: [ADMIN_AUDIT_LOG_REPOSITORY],
})
export class AdminModule {}
