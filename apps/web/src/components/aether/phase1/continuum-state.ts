/**
 * Continuum URL state — re-export from `@app/aether-canvas-shared`.
 *
 * Implementation moved to the shared package in AE470 so the Phase 4
 * native iOS Continuity handoff + Android NFC pickup decode the
 * same URL encoding the web sender writes. This file remains so
 * existing imports keep working.
 */
export {
  CONTINUUM_QUERY_KEY,
  buildContinuumUrl,
  continuumSigilSeed,
  isContinuumUrl,
  parseContinuumUrl,
  type ContinuumExtras,
  type ContinuumState,
} from '@app/aether-canvas-shared';
