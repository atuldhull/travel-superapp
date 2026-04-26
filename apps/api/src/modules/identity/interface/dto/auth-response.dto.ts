/**
 * Class-based response DTOs for the auth surface. `@nestjs/swagger`
 * needs classes (not interfaces) decorated with `@ApiProperty` to
 * emit real component schemas in `openapi.yaml`. With these in place
 * orval generates strongly-typed return shapes instead of `data: void`.
 *
 * These classes are documentation-only — the controllers still return
 * plain object literals shaped to match. The `implements` keyword is
 * intentionally omitted so we don't have to instantiate them at the
 * call sites.
 *
 * Installed by prompt [IV.18.19.20].
 */
import { ApiProperty } from '@nestjs/swagger';

export class AuthSuccessResponseDto {
  @ApiProperty({ format: 'cuid', description: 'Authenticated user id.' })
  declare userId: string;

  @ApiProperty({
    description: 'Bearer access token (JWT). Memory-only — never localStorage.',
  })
  declare accessToken: string;

  @ApiProperty({
    format: 'date-time',
    description: 'ISO-8601 timestamp at which the access token expires.',
  })
  declare expiresAt: string;
}

export class RefreshSuccessResponseDto {
  @ApiProperty({
    description: 'New bearer access token (JWT). Refresh cookie is rotated server-side.',
  })
  declare accessToken: string;

  @ApiProperty({
    format: 'date-time',
    description: 'ISO-8601 timestamp at which the new access token expires.',
  })
  declare expiresAt: string;
}
