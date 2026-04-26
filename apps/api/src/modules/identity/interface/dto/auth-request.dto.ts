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
