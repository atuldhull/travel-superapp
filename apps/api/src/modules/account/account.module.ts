/**
 * Account module — GDPR / DPDP / COPPA compliance surface.
 *
 * Routes:
 *   - `GET    /account/export` — Art. 15 right-of-access (shipped [IV.18.16.1]).
 *   - `DELETE /account`        — Art. 17 right-to-erasure (shipped [IV.18.16.2]).
 *
 * Hard-delete cron (sweeps soft-deleted users after a 7-day
 * window) lives in this module too and lands in a follow-up
 * slice. Cascade is wired at the schema level: every user-scoped
 * FK has `onDelete: Cascade`, so the cron just calls
 * `prisma.user.delete({ where: { id, deletedAt: { lte: now-7d }}})`.
 *
 * No new dependencies: both adapters use direct Prisma reads /
 * writes via the global `PrismaService`.
 *
 * Installed by prompt [IV.18.16.1]. Erasure flow added in
 * [IV.18.16.2].
 */
import { Module } from '@nestjs/common';
import { DeleteAccountUseCase } from './application/delete-account.use-case';
import { ExportUserDataUseCase } from './application/export-user-data.use-case';
import { ACCOUNT_DELETER } from './application/ports/account-deleter';
import { USER_DATA_AGGREGATOR } from './application/ports/user-data-aggregator';
import { PrismaAccountDeleter } from './infrastructure/prisma-account-deleter';
import { PrismaUserDataAggregator } from './infrastructure/prisma-user-data-aggregator';
import { AccountController } from './interface/account.controller';

@Module({
  controllers: [AccountController],
  providers: [
    { provide: USER_DATA_AGGREGATOR, useClass: PrismaUserDataAggregator },
    { provide: ACCOUNT_DELETER, useClass: PrismaAccountDeleter },
    ExportUserDataUseCase,
    DeleteAccountUseCase,
  ],
})
export class AccountModule {}
