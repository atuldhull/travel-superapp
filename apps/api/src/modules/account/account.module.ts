/**
 * Account module — GDPR / DPDP / COPPA compliance surface.
 *
 * v1 ships `GET /account/export` only. The delete-my-account
 * (`POST /account/delete`) flow plus a 7-day soft-delete sweep
 * cron belong in this module too and land in a follow-up slice.
 *
 * No new dependencies: the aggregator is direct Prisma reads via
 * the global `PrismaService`.
 *
 * Installed by prompt [IV.18.16.1].
 */
import { Module } from '@nestjs/common';
import { ExportUserDataUseCase } from './application/export-user-data.use-case';
import { USER_DATA_AGGREGATOR } from './application/ports/user-data-aggregator';
import { PrismaUserDataAggregator } from './infrastructure/prisma-user-data-aggregator';
import { AccountController } from './interface/account.controller';

@Module({
  controllers: [AccountController],
  providers: [
    { provide: USER_DATA_AGGREGATOR, useClass: PrismaUserDataAggregator },
    ExportUserDataUseCase,
  ],
})
export class AccountModule {}
