/**
 * Account / GDPR HTTP surface.
 *
 *   GET    /api/v1/account/export        — returns the full user
 *          data bundle as a single JSON object. Compliance surface
 *          for GDPR Art. 15, India DPDP §11, COPPA. Original v1.
 *   GET    /api/v1/account/export.ndjson — line-by-line NDJSON
 *          variant of the same bundle. Each line is one
 *          `{type,data}` envelope; clients can parse incrementally
 *          ([IV.18.16.4]).
 *   DELETE /api/v1/account               — soft-deletes the caller's
 *          account + revokes all live sessions. GDPR Art. 17 /
 *          DPDP §12 right-to-erasure. Hard-delete cron (7-day
 *          window) is the natural follow-up.
 *
 * Auth: standard `JwtAuthGuard` (no @Public, no @Roles). Each
 * route operates only on the caller's own data — the underlying
 * use-cases are owner-scoped on every read/write.
 *
 * Installed by prompt [IV.18.16.1]. DELETE added in [IV.18.16.2].
 * NDJSON streaming added in [IV.18.16.4].
 */
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Post, Res } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiProperty,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { z } from 'zod';
import type { FastifyReply } from 'fastify';
import { Readable } from 'node:stream';
import { type AuthenticatedUser, CurrentUser, Public } from '../../../common/auth';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { DeleteAccountUseCase } from '../application/delete-account.use-case';
import { ExportUserDataUseCase } from '../application/export-user-data.use-case';
import {
  GetStorageStatsUseCase,
  type StorageStats,
} from '../application/get-storage-stats.use-case';
import { ReactivateAccountUseCase } from '../application/reactivate-account.use-case';
import { StreamAccountExportUseCase } from '../application/stream-account-export.use-case';
import { SubmitBanAppealUseCase } from '../application/submit-ban-appeal.use-case';
import type { UserDataExport } from '../domain/user-data-export.entity';
import { StorageStatsResponseDto, UserDataExportResponseDto } from './dto/account-response.dto';

class ReactivateRequestDto {
  @ApiProperty({
    description:
      'V.UX.33 — opaque base64url HMAC token from the deletion-pending email or login response.',
  })
  declare token: string;
}

class ReactivateResponseDto {
  @ApiProperty({ format: 'cuid', description: 'Restored user id.' })
  declare userId: string;
}

const ReactivateBodySchema = z.object({
  token: z.string().min(20).max(2048),
});
type ReactivateBody = z.infer<typeof ReactivateBodySchema>;

class AppealRequestDto {
  @ApiProperty({ format: 'email', maxLength: 254 })
  declare email: string;

  @ApiProperty({ minLength: 10, maxLength: 2000 })
  declare body: string;
}

const AppealBodySchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  body: z.string().trim().min(10).max(2000),
});
type AppealBody = z.infer<typeof AppealBodySchema>;

@ApiTags('account')
@ApiBearerAuth()
@Controller('account')
export class AccountController {
  constructor(
    private readonly exportUc: ExportUserDataUseCase,
    private readonly streamExportUc: StreamAccountExportUseCase,
    private readonly deleteUc: DeleteAccountUseCase,
    private readonly storageStatsUc: GetStorageStatsUseCase,
    private readonly reactivateUc: ReactivateAccountUseCase,
    private readonly submitAppealUc: SubmitBanAppealUseCase,
  ) {}

  /**
   * V.UX.32 — per-category storage stats. One round-trip per
   * category via parallel `Promise.all` of indexed counts. Powers
   * the `/account/privacy` dashboard.
   */
  @ApiOperation({
    summary:
      "V.UX.32 — caller-scoped storage stats per category. Powers the /account/privacy hub's 'we store: 24 trips, 130 photos…' panel.",
  })
  @ApiResponse({
    status: 200,
    description: 'Per-category row counts.',
    type: StorageStatsResponseDto,
  })
  @Get('stats')
  @HttpCode(HttpStatus.OK)
  async storageStats(@CurrentUser() user: AuthenticatedUser): Promise<StorageStats> {
    return this.storageStatsUc.execute(user.sub);
  }

  @ApiOperation({
    summary:
      'Full GDPR/DPDP/COPPA self-export bundle as a single JSON object. ~30 sections; sensitive fields stripped.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Full export bundle. Per-section row shapes documented in user-data-export.entity.ts.',
    type: UserDataExportResponseDto,
  })
  @Get('export')
  @HttpCode(HttpStatus.OK)
  async exportMyData(@CurrentUser() user: AuthenticatedUser): Promise<UserDataExport> {
    return this.exportUc.execute(user.sub);
  }

  /**
   * NDJSON variant — one envelope per line. Content-Type is the
   * conventional `application/x-ndjson` so downstream tooling
   * (jq -c, ndjson-cli, line-readers) detects the format. The
   * generator yields each line eagerly; `Readable.from` pipes
   * through Fastify's response without buffering the whole bundle
   * a second time.
   *
   * Note: the underlying aggregator still loads the bundle into
   * memory (the use-case JSDoc documents this honestly). Wire-
   * format streaming today; cursor-based section streaming queued
   * for v2.
   *
   * Errors thrown inside the generator (e.g. `UserNotFoundError`)
   * surface BEFORE the stream is wired — `await` on the first
   * iterator step propagates them and Nest's exception filter
   * renders the standard error response.
   */
  @ApiOperation({
    summary:
      'NDJSON variant of the export bundle — one `{type,data}` envelope per line. Content-Type: application/x-ndjson.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Streaming NDJSON. Each line is a `{type,data}` envelope; downstream tooling (jq -c, ndjson-cli) parses incrementally.',
  })
  @Get('export.ndjson')
  async exportMyDataNdjson(
    @CurrentUser() user: AuthenticatedUser,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const generator = this.streamExportUc.execute(user.sub);
    // Probe the first chunk so a thrown UserNotFoundError surfaces
    // BEFORE we set the streaming response shape — keeps the
    // exception path consistent with the JSON variant.
    const first = await generator.next();
    if (first.done) {
      // Vanishingly unlikely: aggregator returned an empty bundle.
      // Send an empty 200 — the client's parser will see zero lines.
      reply
        .status(HttpStatus.OK)
        .header('content-type', 'application/x-ndjson; charset=utf-8')
        .send('');
      return;
    }
    const stream = Readable.from(replayThenContinue(first.value, generator));
    reply
      .status(HttpStatus.OK)
      .header('content-type', 'application/x-ndjson; charset=utf-8')
      .header('cache-control', 'no-store')
      .send(stream);
  }

  @ApiOperation({
    summary:
      "Soft-delete the caller's account + revoke all live sessions. GDPR Art. 17 / DPDP §12 right-to-erasure.",
  })
  @ApiResponse({ status: 204, description: 'Account marked soft-deleted; sessions revoked.' })
  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteMyAccount(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.deleteUc.execute(user.sub);
  }

  /**
   * V.UX.33 — reactivate a soft-deleted account inside the 7-day
   * retention window. @Public — the bearer route can't be used (the
   * sessions were revoked at delete time). Identity proof is the
   * HMAC reactivation token (from the deletion-pending email OR the
   * login response when valid credentials hit a soft-deleted row).
   *
   * Idempotent on the side effect: re-clicking a link after restore
   * returns 404 ACCOUNT_NOT_RECOVERABLE (the row is now active);
   * the web client treats both 200 and that 404 as "you're good,
   * sign in".
   */
  @ApiOperation({
    summary:
      'V.UX.33 — restore a soft-deleted account within the 7-day window. Token from deletion-pending email or login response.',
  })
  @ApiBody({ type: ReactivateRequestDto })
  @ApiResponse({ status: 200, description: 'Account restored.', type: ReactivateResponseDto })
  @ApiResponse({ status: 401, description: 'REACTIVATION_INVALID — token bad/expired.' })
  @ApiResponse({ status: 404, description: 'ACCOUNT_NOT_RECOVERABLE — past the 7-day window.' })
  @Public()
  @Post('reactivate')
  @HttpCode(HttpStatus.OK)
  async reactivate(
    @Body(new ZodValidationPipe(ReactivateBodySchema)) body: ReactivateBody,
  ): Promise<{ userId: string }> {
    return this.reactivateUc.execute({ token: body.token });
  }

  /**
   * V.UX.34 — submit a ban appeal. Unauthed (banned users can't
   * bearer-auth). Always returns 200 — non-existent + non-banned
   * emails silently succeed (no enumeration leak). Soft rate-
   * limited at 3 appeals per email per hour inside the use-case.
   */
  @ApiOperation({
    summary:
      'V.UX.34 — submit a ban appeal. Always returns 200 regardless of registration / ban state.',
  })
  @ApiBody({ type: AppealRequestDto })
  @ApiResponse({ status: 200, description: 'Always ok.' })
  @ApiResponse({ status: 422, description: 'INVALID_APPEAL_BODY.' })
  @Public()
  @Post('appeal')
  @HttpCode(HttpStatus.OK)
  async appeal(
    @Body(new ZodValidationPipe(AppealBodySchema)) body: AppealBody,
  ): Promise<{ status: 'ok' }> {
    await this.submitAppealUc.execute({ email: body.email, body: body.body });
    return { status: 'ok' };
  }
}

/**
 * Helper: emit `first` (which we already pulled to surface
 * errors), then drain the rest of the generator. Lets the
 * controller probe the first chunk without losing it.
 */
async function* replayThenContinue<T>(
  first: T,
  rest: AsyncGenerator<T, void, void>,
): AsyncGenerator<T, void, void> {
  yield first;
  for await (const chunk of rest) yield chunk;
}
