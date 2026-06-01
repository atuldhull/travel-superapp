/**
 * Presigned URL TTL helpers — re-export from `@app/aether-canvas-shared`.
 *
 * Implementation moved to the shared package in AE479 so native +
 * web compute identical refetch timing for presigned media URLs.
 * This file remains so existing imports keep working.
 */
export {
  DEFAULT_TTL_REFETCH_MARGIN_MS,
  isExpiryNear,
  msUntilExpiry,
  refetchDelayMs,
} from '@app/aether-canvas-shared';
