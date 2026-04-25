/**
 * Account / GDPR HTTP surface.
 *
 *   GET    /api/v1/account/export — returns the full user data
 *          bundle for the authed caller. Compliance surface for
 *          GDPR Art. 15 ("right of access"), India DPDP §11,
 *          COPPA parental data review.
 *   DELETE /api/v1/account        — soft-deletes the caller's
 *          account + revokes all live sessions. GDPR Art. 17 /
 *          DPDP §12 right-to-erasure. Hard-delete cron (7-day
 *          window) is the natural follow-up.
 *
 * Auth: standard `JwtAuthGuard` (no @Public, no @Roles). Each
 * route operates only on the caller's own data — the underlying
 * use-cases are owner-scoped on every read/write.
 *
 * Installed by prompt [IV.18.16.1]. DELETE added in [IV.18.16.2].
 */
import { Controller, Delete, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { type AuthenticatedUser, CurrentUser } from '../../../common/auth';
import { DeleteAccountUseCase } from '../application/delete-account.use-case';
import { ExportUserDataUseCase } from '../application/export-user-data.use-case';
import type { UserDataExport } from '../domain/user-data-export.entity';

@Controller('account')
export class AccountController {
  constructor(
    private readonly exportUc: ExportUserDataUseCase,
    private readonly deleteUc: DeleteAccountUseCase,
  ) {}

  @Get('export')
  @HttpCode(HttpStatus.OK)
  async exportMyData(@CurrentUser() user: AuthenticatedUser): Promise<UserDataExport> {
    return this.exportUc.execute(user.sub);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteMyAccount(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.deleteUc.execute(user.sub);
  }
}
