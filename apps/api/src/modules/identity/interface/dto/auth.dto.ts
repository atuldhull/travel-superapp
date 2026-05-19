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

/**
 * Body for `POST /auth/magic-link/request`. Email-only — no password,
 * no displayName. The request endpoint is intentionally non-revealing:
 * it always returns 200 regardless of whether the email is registered.
 *
 * Installed by prompt [V.UX.2].
 */
export const MagicLinkRequestBodySchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
});
export type MagicLinkRequestBody = z.infer<typeof MagicLinkRequestBodySchema>;

/**
 * Body for `POST /auth/magic-link/consume`. The token is the URL
 * fragment from the email link — 64 hex chars (32 random bytes).
 *
 * Installed by prompt [V.UX.2].
 */
export const MagicLinkConsumeBodySchema = z.object({
  token: z.string().regex(/^[0-9a-f]{64}$/, 'token must be 64 lower-case hex characters'),
});
export type MagicLinkConsumeBody = z.infer<typeof MagicLinkConsumeBodySchema>;

/**
 * Phase 1 (B1/B2) — passwordless OTP. One body for both channels; the
 * destination is validated per channel (email shape vs E.164-ish
 * phone). Phone: optional leading `+` then 7..15 digits.
 */
const PHONE_RE = /^\+?[1-9]\d{6,14}$/;
export const LoginCodeRequestBodySchema = z
  .object({
    channel: z.enum(['email', 'phone']),
    destination: z.string().trim().min(3).max(254),
  })
  .superRefine((v, ctx) => {
    if (v.channel === 'email') {
      if (!z.string().email().max(254).safeParse(v.destination).success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['destination'],
          message: 'invalid email',
        });
      }
    } else if (!PHONE_RE.test(v.destination.replace(/[\s()-]/g, ''))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['destination'],
        message: 'invalid phone',
      });
    }
  });
export type LoginCodeRequestBody = z.infer<typeof LoginCodeRequestBodySchema>;

export const LoginCodeVerifyBodySchema = z
  .object({
    channel: z.enum(['email', 'phone']),
    destination: z.string().trim().min(3).max(254),
    code: z.string().regex(/^\d{6}$/, 'must be 6 digits'),
  })
  .superRefine((v, ctx) => {
    if (v.channel === 'email') {
      if (!z.string().email().max(254).safeParse(v.destination).success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['destination'],
          message: 'invalid email',
        });
      }
    } else if (!PHONE_RE.test(v.destination.replace(/[\s()-]/g, ''))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['destination'],
        message: 'invalid phone',
      });
    }
  });
export type LoginCodeVerifyBody = z.infer<typeof LoginCodeVerifyBodySchema>;

/**
 * Body for `POST /auth/onboarding/complete`. Empty `{}` works for the
 * "Generate" terminal (the user already has a trip). The Skip terminal
 * sends `{seedSample: true}` so the api seeds the read-only Goa weekend
 * before flipping the flag.
 *
 * Installed by prompt [V.UX.3].
 */
export const OnboardingCompleteBodySchema = z.object({
  seedSample: z.boolean().optional(),
});
export type OnboardingCompleteBody = z.infer<typeof OnboardingCompleteBodySchema>;

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

/**
 * V.UX.31 — body for `POST /auth/password-reset/request`. Email-only,
 * non-revealing (always 200 regardless of registration state).
 */
export const PasswordResetRequestBodySchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
});
export type PasswordResetRequestBody = z.infer<typeof PasswordResetRequestBodySchema>;

/**
 * V.UX.31 — body for `POST /auth/password-reset/consume`. The token
 * is the URL-fragment from the email link (64 hex chars, 32 random
 * bytes). New password follows the same complexity rules as register.
 */
export const PasswordResetConsumeBodySchema = z.object({
  token: z.string().regex(/^[0-9a-f]{64}$/, 'token must be 64 lower-case hex characters'),
  newPassword: z.string().min(12).max(128),
});
export type PasswordResetConsumeBody = z.infer<typeof PasswordResetConsumeBodySchema>;
