/**
 * ai-service `/v1/translate` — NLLB-200 translation.
 *
 * Authored from the contract at `docs/services/ai-service/contract.md`
 * §2 — this file is the SINGLE SOURCE OF TRUTH; the contract doc is
 * the prose form of these schemas, the Python `ai-service` mirrors
 * them as pydantic models via codegen.
 *
 * Installed by prompt [A5].
 */
import { z } from 'zod';

/** Optional content-domain hint that lets NLLB pick a fine-tuned head. */
export const TranslateDomain = z.enum(['general', 'food', 'navigation', 'safety']);
export type TranslateDomain = z.infer<typeof TranslateDomain>;

export const TranslateRequest = z.object({
  /** ISO-639-1 source language code (2 lowercase letters). */
  sourceLang: z.string().length(2),
  /** ISO-639-1 target language code. */
  targetLang: z.string().length(2),
  /** Plaintext to translate, capped at 4000 chars per call. */
  text: z.string().min(1).max(4_000),
  domain: TranslateDomain.optional(),
});
export type TranslateRequest = z.infer<typeof TranslateRequest>;

export const TranslateResponse = z.object({
  text: z.string(),
  /** e.g. `"nllb-200-distilled-600M@2024-10-12"`. */
  modelVersion: z.string(),
  cacheHit: z.boolean(),
  latencyMs: z.number().int().nonnegative(),
});
export type TranslateResponse = z.infer<typeof TranslateResponse>;
