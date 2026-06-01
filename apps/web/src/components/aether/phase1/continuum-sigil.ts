/**
 * Continuum sigil grid — re-export from `@app/aether-canvas-shared`.
 *
 * Implementation moved to the shared package in AE470 so web + native
 * render identical sigil grids from the same handoff seed. This file
 * remains so existing imports keep working.
 */
export {
  DEFAULT_SIGIL_SIZE,
  buildSigilGrid,
  hashSeed,
  sigilEquals,
  sigilFilledCount,
  type SigilGrid,
} from '@app/aether-canvas-shared';
