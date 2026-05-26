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
  @ApiProperty({
    format: 'cuid',
    description: 'Authenticated user id.',
    example: 'clxn8q3t40000jq08yzn4l1ab',
  })
  declare userId: string;

  @ApiProperty({
    description: 'Bearer access token (JWT). Memory-only — never localStorage.',
    example:
      'eyJhbGciOiJSUzI1NiIsImtpZCI6IjFhYjJjM2Q0In0.eyJzdWIiOiJjbHhuOHEzdDQwMDAwIn0.signature…',
  })
  declare accessToken: string;

  @ApiProperty({
    format: 'date-time',
    description: 'ISO-8601 timestamp at which the access token expires.',
    example: '2026-05-26T10:35:00.000Z',
  })
  declare expiresAt: string;
}

export class RefreshSuccessResponseDto {
  @ApiProperty({
    description: 'New bearer access token (JWT). Refresh cookie is rotated server-side.',
    example:
      'eyJhbGciOiJSUzI1NiIsImtpZCI6IjFhYjJjM2Q0In0.eyJzdWIiOiJjbHhuOHEzdDQwMDAwIn0.signature…',
  })
  declare accessToken: string;

  @ApiProperty({
    format: 'date-time',
    description: 'ISO-8601 timestamp at which the new access token expires.',
    example: '2026-05-26T10:50:00.000Z',
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
    example: 'ok',
  })
  declare status: string;
}

/**
 * V.UX.31 — response of `POST /auth/password-reset/request`. Same
 * shape (and same enumeration-safe semantics) as the magic-link
 * request response.
 */
export class PasswordResetRequestResponseDto {
  @ApiProperty({
    enum: ['ok'],
    description: "Always 'ok'. Doesn't reveal whether the email is registered.",
    example: 'ok',
  })
  declare status: string;
}

/**
 * V.UX.31 — response of `POST /auth/password-reset/consume`.
 * Body is intentionally minimal — the user must explicitly sign in
 * with the new password. We don't auto-issue a session because the
 * common case is "I forgot my password on a public computer"; we
 * don't want a session to land in a browser the user just borrowed.
 */
export class PasswordResetConsumeResponseDto {
  @ApiProperty({ enum: ['ok'], example: 'ok' })
  declare status: string;
}

/**
 * Response of `GET /auth/me`. Returns the stable JWT claims plus a
 * couple of hydrated User-row fields the web client needs to make
 * routing decisions WITHOUT a separate round-trip:
 *   - `hasSeenOnboarding` controls the post-login bounce (V.UX.3).
 *
 * Hydrating displayName / email / verified flags is queued for a
 * follow-up.
 */
export class WhoAmIResponseDto {
  @ApiProperty({
    format: 'cuid',
    description: 'User id (`sub` claim).',
    example: 'clxn8q3t40000jq08yzn4l1ab',
  })
  declare sub: string;

  @ApiProperty({
    format: 'cuid',
    description: 'Session id (`sid` claim).',
    example: 'clxn8q9f80001jq08kk72g3dx',
  })
  declare sid: string;

  @ApiProperty({
    enum: ['user', 'premium', 'agent', 'admin', 'compliance', 'sre'],
    description: 'Role assigned to the session.',
    example: 'user',
  })
  declare role: 'user' | 'premium' | 'agent' | 'admin' | 'compliance' | 'sre';

  @ApiProperty({
    description:
      'True iff the user has completed (or skipped) the 3-step onboarding wizard. Web client uses this to decide whether to bounce post-login → /onboarding or → /trips. Installed by [V.UX.3].',
    example: true,
  })
  declare hasSeenOnboarding: boolean;

  @ApiProperty({
    nullable: true,
    format: 'date-time',
    description:
      'V.UX.30 — the visit BEFORE the current one. Web compares this against now() to decide whether to render the welcome-back hero (>30d gap fires it). Null on first sign-in.',
    example: '2026-04-12T18:22:30.000Z',
  })
  declare previousSeenAt: string | null;
}

/**
 * Response of `POST /auth/onboarding/complete`. Always returns
 * `{status:'ok'}` — the meaningful side-effect is the User-row flip.
 *
 * Installed by prompt [V.UX.3].
 */
export class OnboardingCompleteResponseDto {
  @ApiProperty({ enum: ['ok'], example: 'ok' })
  declare status: string;
}
