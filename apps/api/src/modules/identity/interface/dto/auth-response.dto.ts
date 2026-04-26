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

/**
 * Response of `POST /auth/magic-link/request`. Always returns success
 * regardless of whether the email is registered (privacy + enumeration
 * defence). Body is intentionally minimal — the meaningful side-effect
 * is the email send, not the response payload.
 *
 * Installed by prompt [V.UX.2].
 */
export class MagicLinkRequestResponseDto {
  @ApiProperty({
    enum: ['ok'],
    description: "Always 'ok'. Doesn't reveal whether the email is registered.",
  })
  declare status: string;
}

/**
 * Response of `GET /auth/me`. Mirrors `AuthenticatedUser` —
 * deliberately minimal: just the stable JWT claims. Hydrating
 * displayName / email / flags is a follow-up use-case.
 */
export class WhoAmIResponseDto {
  @ApiProperty({ format: 'cuid', description: 'User id (`sub` claim).' })
  declare sub: string;

  @ApiProperty({ format: 'cuid', description: 'Session id (`sid` claim).' })
  declare sid: string;

  @ApiProperty({
    enum: ['user', 'premium', 'agent', 'admin'],
    description: 'Role assigned to the session.',
  })
  declare role: 'user' | 'premium' | 'agent' | 'admin';
}
