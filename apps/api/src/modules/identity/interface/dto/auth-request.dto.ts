/**
 * Class-based request DTOs for the auth surface. Documentation-only:
 * the runtime validation still happens via the Zod schemas in
 * `auth.dto.ts`. These classes exist purely so `@nestjs/swagger`
 * emits matching `requestBody` schemas in `openapi.yaml`, which orval
 * then turns into typed `body` parameters for the generated mutation
 * hooks. Without these, consumers would have to hand-construct
 * RequestInit bodies by hand.
 *
 * Pair these with `@ApiBody({ type: <ClassName> })` on the controller
 * route. The Zod pipe still does the actual validation.
 *
 * Installed by prompt [IV.18.19.21].
 */
import { ApiProperty } from '@nestjs/swagger';

export class LoginRequestDto {
  @ApiProperty({ format: 'email', maxLength: 254 })
  declare email: string;

  @ApiProperty({ minLength: 1, maxLength: 128 })
  declare password: string;

  @ApiProperty({
    required: false,
    description: '6-digit TOTP or 8-char backup code (only on the second call when MFA is on).',
    pattern: '^(\\d{6}|[A-Za-z0-9]{8})$',
  })
  declare mfaCode?: string;
}

export class RegisterRequestDto {
  @ApiProperty({ format: 'email', maxLength: 254 })
  declare email: string;

  @ApiProperty({ minLength: 12, maxLength: 128, description: 'Min 12 chars, max 128.' })
  declare password: string;

  @ApiProperty({ minLength: 1, maxLength: 60 })
  declare displayName: string;
}

export class OAuthSignInRequestDto {
  @ApiProperty({
    description:
      'Provider-issued ID token (e.g. Google id_token, Apple identityToken). Real Google tokens are ~1.2KB; max enforced at 8192.',
    minLength: 1,
    maxLength: 8192,
  })
  declare idToken: string;
}

export class MagicLinkRequestRequestDto {
  @ApiProperty({ format: 'email', maxLength: 254 })
  declare email: string;
}

export class MagicLinkConsumeRequestDto {
  @ApiProperty({
    description: '64 lower-case hex characters (32 random bytes) from the email link URL.',
    pattern: '^[0-9a-f]{64}$',
    minLength: 64,
    maxLength: 64,
  })
  declare token: string;
}

export class OnboardingCompleteRequestDto {
  @ApiProperty({
    required: false,
    description:
      'When true, also seed a read-only "Sample trip — Goa weekend" if the user has zero trips. Sent from the Skip terminal of the onboarding wizard. Idempotent.',
  })
  declare seedSample?: boolean;
}

/**
 * V.UX.31 — `POST /auth/password-reset/request` body.
 */
export class PasswordResetRequestRequestDto {
  @ApiProperty({ format: 'email', maxLength: 254 })
  declare email: string;
}

/**
 * V.UX.31 — `POST /auth/password-reset/consume` body.
 */
export class PasswordResetConsumeRequestDto {
  @ApiProperty({
    description: '64 lower-case hex characters (32 random bytes) from the email link URL.',
    pattern: '^[0-9a-f]{64}$',
    minLength: 64,
    maxLength: 64,
  })
  declare token: string;

  @ApiProperty({ minLength: 12, maxLength: 128, description: 'New password (12..128 chars).' })
  declare newPassword: string;
}
