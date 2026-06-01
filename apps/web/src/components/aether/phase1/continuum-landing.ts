/**
 * Continuum receiver landing — re-export from `@app/aether-canvas-shared`.
 *
 * Implementation moved to the shared package in AE470 so the Phase 4
 * native receiver (NFC + Continuity deep-link) parses the same query
 * params + formats the same toast copy. This file remains so existing
 * imports keep working.
 */
export {
  NO_CONTINUUM_LANDING,
  formatContinuumLandingMessage,
  readContinuumLanding,
  type ContinuumLanding,
} from '@app/aether-canvas-shared';
