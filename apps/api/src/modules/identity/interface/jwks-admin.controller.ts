/**
 * Admin surface for JWT keyring operations.
 *
 *   POST /api/v1/admin/identity/jwks/rotate — rotate a single ring.
 *         Body: `{ ring: 'access' | 'refresh' }`. Returns the new
 *         kid + the previous-kid list. @Roles('admin'); the global
 *         guard chain rejects non-admins with 403.
 *   GET  /api/v1/admin/identity/jwks/kids   — list every active kid
 *         across both rings (current + previous). Useful for ops to
 *         confirm a rotation landed + to reason about the retirement
 *         window for old kids.
 *
 * Separate controller from `AdminController` (Place curation) —
 * distinct resource, distinct DI graph, trivial to extract to its
 * own module later if identity-admin grows.
 *
 * Installed by prompt [III.13.2.8].
 */
import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { z } from 'zod';
import { Roles } from '../../../common/auth';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { RotateJwksUseCase, type RotateJwksResult } from '../application/rotate-jwks.use-case';
import { JWT_KEYRING_STORE, type JwtKeyringStore } from '../application/ports/jwt-keyring.store';
import { Inject } from '@nestjs/common';

const RotateBodySchema = z.object({
  ring: z.string().trim().min(1).max(32),
});
type RotateBody = z.infer<typeof RotateBodySchema>;

interface RotateResponseDto {
  readonly ring: string;
  readonly newKid: string;
  readonly previousKids: readonly string[];
}

function toDto(r: RotateJwksResult): RotateResponseDto {
  return {
    ring: r.ring,
    newKid: r.newKid,
    previousKids: r.previousKids,
  };
}

@Controller('admin/identity/jwks')
@Roles('admin')
export class JwksAdminController {
  constructor(
    private readonly rotateUc: RotateJwksUseCase,
    @Inject(JWT_KEYRING_STORE) private readonly keyrings: JwtKeyringStore,
  ) {}

  @Post('rotate')
  @HttpCode(HttpStatus.OK)
  async rotate(
    @Body(new ZodValidationPipe(RotateBodySchema)) body: RotateBody,
  ): Promise<RotateResponseDto> {
    const result = await this.rotateUc.execute({ ring: body.ring });
    return toDto(result);
  }

  @Get('kids')
  @HttpCode(HttpStatus.OK)
  async kids(): Promise<{ access: readonly string[]; refresh: readonly string[] }> {
    return this.keyrings.listKids();
  }
}
