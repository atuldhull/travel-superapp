/**
 * Account / GDPR HTTP surface.
 *
 *   GET /api/v1/account/export — returns the full user data
 *   bundle for the authed caller. Compliance surface for GDPR
 *   Art. 15 ("right of access"), India DPDP §11, COPPA parental
 *   data review.
 *
 * Auth: standard `JwtAuthGuard` (no @Public, no @Roles). The
 * caller can only export their own bundle — the underlying
 * aggregator is owner-scoped on every section query.
 *
 * The natural follow-up surface is `POST /account/delete`
 * (right-to-erasure). v1 only ships the read; the delete flow
 * needs a 7-day soft-delete window + hard-delete cron and lands
 * in a follow-up slice.
 *
 * Installed by prompt [IV.18.16.1].
 */
import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { type AuthenticatedUser, CurrentUser } from '../../../common/auth';
import { ExportUserDataUseCase } from '../application/export-user-data.use-case';
import type { UserDataExport } from '../domain/user-data-export.entity';

@Controller('account')
export class AccountController {
  constructor(private readonly exportUc: ExportUserDataUseCase) {}

  @Get('export')
  @HttpCode(HttpStatus.OK)
  async exportMyData(@CurrentUser() user: AuthenticatedUser): Promise<UserDataExport> {
    return this.exportUc.execute(user.sub);
  }
}
