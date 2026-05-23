/**
 * ai-service shared contract — the SINGLE SOURCE OF TRUTH for the
 * NestJS↔FastAPI boundary. The doc at
 * `docs/services/ai-service/contract.md` is the prose form; these
 * Zod schemas are the executable form. The Python service mirrors
 * them as pydantic models via codegen (see `[IV.18.2.11]`).
 *
 * Consume via:
 *
 *   import { TranslateRequest, type TranslateResponse } from '@app/shared-types/ai-service';
 *
 * Installed by prompt [A5].
 */
export * from './translate';
export * from './stt';
export * from './fake-review';
export * from './crowd';
export * from './embeddings';
export * from './health';
