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
import { AdminBanUserUseCase } from './application/admin-ban-user.use-case';
import { AdminListUsersUseCase } from './application/admin-list-users.use-case';
import { AdminUnbanUserUseCase } from './application/admin-unban-user.use-case';
import { DeleteAccountUseCase } from './application/delete-account.use-case';
import { ExportUserDataUseCase } from './application/export-user-data.use-case';
import { ACCOUNT_DELETER } from './application/ports/account-deleter';
import { ACCOUNT_PURGER } from './application/ports/account-purger';
import { ADMIN_USER_QUERY } from './application/ports/admin-user-query';
import { USER_DATA_AGGREGATOR } from './application/ports/user-data-aggregator';
import { PurgeSoftDeletedUsersUseCase } from './application/purge-soft-deleted-users.use-case';
import { PrismaAccountDeleter } from './infrastructure/prisma-account-deleter';
import { PrismaAccountPurger } from './infrastructure/prisma-account-purger';
import { PrismaAdminUserQuery } from './infrastructure/prisma-admin-user-query';
import { PrismaUserDataAggregator } from './infrastructure/prisma-user-data-aggregator';
import { AccountPurgeScheduler } from './interface/account-purge.scheduler';
import { AccountController } from './interface/account.controller';
import { AdminUsersController } from './interface/admin-users.controller';

@Module({
  controllers: [AccountController, AdminUsersController],
  providers: [
    { provide: USER_DATA_AGGREGATOR, useClass: PrismaUserDataAggregator },
    { provide: ACCOUNT_DELETER, useClass: PrismaAccountDeleter },
    { provide: ACCOUNT_PURGER, useClass: PrismaAccountPurger },
    { provide: ADMIN_USER_QUERY, useClass: PrismaAdminUserQuery },
    ExportUserDataUseCase,
    DeleteAccountUseCase,
    PurgeSoftDeletedUsersUseCase,
    AccountPurgeScheduler,
    AdminListUsersUseCase,
    AdminBanUserUseCase,
    AdminUnbanUserUseCase,
  ],
  exports: [PurgeSoftDeletedUsersUseCase],
})
export class AccountModule {}
