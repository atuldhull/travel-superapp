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
import { Controller, Delete, Get, HttpCode, HttpStatus, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import { Readable } from 'node:stream';
import { type AuthenticatedUser, CurrentUser } from '../../../common/auth';
import { DeleteAccountUseCase } from '../application/delete-account.use-case';
import { ExportUserDataUseCase } from '../application/export-user-data.use-case';
import { StreamAccountExportUseCase } from '../application/stream-account-export.use-case';
import type { UserDataExport } from '../domain/user-data-export.entity';
import { UserDataExportResponseDto } from './dto/account-response.dto';

@ApiTags('account')
@ApiBearerAuth()
@Controller('account')
export class AccountController {
  constructor(
    private readonly exportUc: ExportUserDataUseCase,
    private readonly streamExportUc: StreamAccountExportUseCase,
    private readonly deleteUc: DeleteAccountUseCase,
  ) {}

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
