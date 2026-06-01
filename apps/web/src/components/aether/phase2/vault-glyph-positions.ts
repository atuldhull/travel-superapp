/**
 * Vault glyph-ring math — re-export from `@app/aether-canvas-shared`.
 *
 * Implementation moved to the shared package in AE456 so the Phase 4
 * native Vault scene consumes identical sphere positions. This file
 * remains so existing imports keep working.
 */
export {
  DEFAULT_VAULT_BASE_SCALE,
  DEFAULT_VAULT_FLOAT_AMPLITUDE,
  DEFAULT_VAULT_FLOAT_FREQUENCY,
  DEFAULT_VAULT_PHASE_OFFSET,
  DEFAULT_VAULT_RING_RADIUS,
  glyphFloatY,
  glyphHaloIntensity,
  glyphRingPosition,
  glyphSphereScale,
} from '@app/aether-canvas-shared';
