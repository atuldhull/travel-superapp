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
});
export type LoginBody = z.infer<typeof LoginBodySchema>;
