/**
 * Vault price + sparkline math — re-export from `@app/aether-canvas-shared`.
 *
 * Implementation moved to the shared package in AE479 so the Phase 4
 * native Vault renders identical glyph weights + sparklines. This
 * file remains so existing imports keep working.
 */
export {
  DEFAULT_VAULT_LAYOUT,
  formatMinorAmount,
  glyphOpacity,
  glyphSize,
  priceDroppedRecently,
  priceSparkline,
  type SparklinePoint,
  type VaultLayoutConfig,
  type VaultPriceLike,
} from '@app/aether-canvas-shared';
