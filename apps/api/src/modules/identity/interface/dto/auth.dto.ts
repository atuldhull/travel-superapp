/**
 * Zod schemas for the auth endpoints. The real request body is parsed
 * with `ZodValidationPipe` (common pipe) — schemas live here so the
 * domain DTOs and HTTP DTOs can diverge later without churn.
 *
 * Password policy is intentionally mild for this slice: min 12, max
 * 128. Entropy scoring + breach-list check (HIBP k-anon) is a
 * follow-up prompt.
 *
 * Installed by prompt [III.13.2] part 2.
 */
import { z } from 'zod';

export const RegisterBodySchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(12).max(128),
  displayName: z.string().trim().min(1).max(60),
});
export type RegisterBody = z.infer<typeof RegisterBodySchema>;

export const LoginBodySchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(128),
  /**
   * MFA code — either a 6-digit TOTP from an authenticator app OR
   * an 8-char alphanumeric backup code. Optional in the DTO because
   * the flow is: (1) /login without a code returns 401 `MFA_REQUIRED`
   * if MFA is on, (2) client submits /login again with the code.
   * The LoginUseCase inspects shape to pick which verifier runs.
   */
  mfaCode: z
    .string()
    .regex(/^(\d{6}|[A-Za-z0-9]{8})$/, 'must be a 6-digit TOTP or 8-char backup code')
    .optional(),
});
export type LoginBody = z.infer<typeof LoginBodySchema>;

/**
 * Body for `/auth/mfa/verify` and `/auth/mfa/disable` — always
 * a 6-digit TOTP code (backup codes can't enrol, can't disable).
 */
export const MfaCodeBodySchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'must be 6 digits'),
});
export type MfaCodeBody = z.infer<typeof MfaCodeBodySchema>;

/**
 * Body for `POST /auth/oauth/:provider` — the provider-issued ID
 * token. Length bound is generous: real Google ID tokens are
 * ~1.2KB; 8192 caps pathological payloads without clipping valid
 * tokens.
 */
export const OAuthSignInBodySchema = z.object({
  idToken: z.string().min(1).max(8192),
});
export type OAuthSignInBody = z.infer<typeof OAuthSignInBodySchema>;
