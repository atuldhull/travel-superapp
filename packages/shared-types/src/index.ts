/**
 * `@app/shared-types` — Zod schemas + inferred TS types shared
 * across the backend (NestJS) and the frontend / sibling services.
 *
 * Sub-paths:
 *   - `@app/shared-types/ai-service` — contract for `apps/ai-service`
 *     (NLLB / Whisper / DistilBERT / crowd / embeddings / health).
 *
 * Re-exported here for ergonomic flat imports too:
 *
 *   import { TranslateRequest } from '@app/shared-types';
 */
export * as aiService from './ai-service';
