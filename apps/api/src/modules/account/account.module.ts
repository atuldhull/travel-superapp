/**
 * Account module — GDPR / DPDP / COPPA compliance surface.
 *
 * Routes:
 *   - `GET    /account/export` — Art. 15 right-of-access (shipped [IV.18.16.1]).
 *   - `DELETE /account`        — Art. 17 right-to-erasure (shipped [IV.18.16.2]).
 *
 * Background:
 *   - `AccountPurgeScheduler` — daily tick that hard-deletes users
 *     whose `deletedAt` is older than the 7-day retention window
 *     (shipped [IV.18.16.3]). Cascades through every user-scoped
 *     FK via Postgres `onDelete: Cascade`.
 *
 * No new dependencies: every adapter uses direct Prisma reads /
 * writes via the global `PrismaService`. The purge scheduler uses
 * a plain `setInterval` rather than `@nestjs/schedule` — see the
 * scheduler's JSDoc for the swap path when multi-instance / cron-
 * syntax requirements arrive.
 *
 * Installed by prompt [IV.18.16.1]. Erasure flow added in
 * [IV.18.16.2]. Hard-delete cron added in [IV.18.16.3].
 */
import { Module } from '@nestjs/common';
import { AddTrustedContactUseCase } from './application/add-trusted-contact.use-case';
import { GetConnectivityInfoUseCase } from './application/get-connectivity-info.use-case';
import { AdminBanUserUseCase } from './application/admin-ban-user.use-case';
import { AdminListUsersUseCase } from './application/admin-list-users.use-case';
import { AdminUnbanUserUseCase } from './application/admin-unban-user.use-case';
import { DeleteAccountUseCase } from './application/delete-account.use-case';
import { DeleteTrustedContactUseCase } from './application/delete-trusted-contact.use-case';
import { ExportUserDataUseCase } from './application/export-user-data.use-case';
import { GetPreferencesUseCase } from './application/get-preferences.use-case';
import { GetStorageStatsUseCase } from './application/get-storage-stats.use-case';
import { ListTrustedContactsUseCase } from './application/list-trusted-contacts.use-case';
import { ReactivateAccountUseCase } from './application/reactivate-account.use-case';
import { StreamAccountExportUseCase } from './application/stream-account-export.use-case';
import { UpdatePreferencesUseCase } from './application/update-preferences.use-case';
import { ACCOUNT_DELETER } from './application/ports/account-deleter';
import { ACCOUNT_PURGER } from './application/ports/account-purger';
import { MAILER_PORT } from '../identity/application/ports/mailer.port';
import { StubMailerAdapter } from '../identity/infrastructure/stub-mailer.adapter';
import { ADMIN_USER_QUERY } from './application/ports/admin-user-query';
import { PREFERENCES_REPOSITORY } from './application/ports/preferences.repository';
import { TRUSTED_CONTACT_REPOSITORY } from './application/ports/trusted-contact.repository';
import { USER_DATA_AGGREGATOR } from './application/ports/user-data-aggregator';
import { PurgeSoftDeletedUsersUseCase } from './application/purge-soft-deleted-users.use-case';
import { PrismaAccountDeleter } from './infrastructure/prisma-account-deleter';
import { PrismaAccountPurger } from './infrastructure/prisma-account-purger';
import { PrismaAdminUserQuery } from './infrastructure/prisma-admin-user-query';
import { PrismaPreferencesRepository } from './infrastructure/prisma-preferences.repository';
import { PrismaTrustedContactRepository } from './infrastructure/prisma-trusted-contact.repository';
import { PrismaUserDataAggregator } from './infrastructure/prisma-user-data-aggregator';
import { AccountPurgeScheduler } from './interface/account-purge.scheduler';
import { AccountController } from './interface/account.controller';
import { AdminPurgeController } from './interface/admin-purge.controller';
import { AdminUsersController } from './interface/admin-users.controller';
import { ConnectivityController } from './interface/connectivity.controller';
import { PreferencesController } from './interface/preferences.controller';
import { TrustedContactsController } from './interface/trusted-contacts.controller';

@Module({
  controllers: [
    AccountController,
    AdminUsersController,
    AdminPurgeController,
    TrustedContactsController,
    PreferencesController,
    ConnectivityController,
  ],
  providers: [
    { provide: USER_DATA_AGGREGATOR, useClass: PrismaUserDataAggregator },
    { provide: ACCOUNT_DELETER, useClass: PrismaAccountDeleter },
    { provide: ACCOUNT_PURGER, useClass: PrismaAccountPurger },
    { provide: ADMIN_USER_QUERY, useClass: PrismaAdminUserQuery },
    { provide: TRUSTED_CONTACT_REPOSITORY, useClass: PrismaTrustedContactRepository },
    { provide: PREFERENCES_REPOSITORY, useClass: PrismaPreferencesRepository },
    ExportUserDataUseCase,
    StreamAccountExportUseCase,
    DeleteAccountUseCase,
    PurgeSoftDeletedUsersUseCase,
    AccountPurgeScheduler,
    AdminListUsersUseCase,
    AdminBanUserUseCase,
    AdminUnbanUserUseCase,
    ListTrustedContactsUseCase,
    AddTrustedContactUseCase,
    DeleteTrustedContactUseCase,
    GetPreferencesUseCase,
    UpdatePreferencesUseCase,
    GetConnectivityInfoUseCase,
    GetStorageStatsUseCase,
    ReactivateAccountUseCase,
    // V.UX.33 — Account needs MAILER_PORT for the deletion-pending
    // email. Identity also registers it; per-module providers are
    // safe because StubMailerAdapter shares state via a module-level
    // ring buffer.
    { provide: MAILER_PORT, useClass: StubMailerAdapter },
  ],
  // V.UX.13 — TRUSTED_CONTACT_REPOSITORY is consumed by the Safety
  // module's TriggerSosUseCase to fan out an SOS to the caller's
  // pre-set contacts.
  exports: [PurgeSoftDeletedUsersUseCase, TRUSTED_CONTACT_REPOSITORY],
})
export class AccountModule {}
