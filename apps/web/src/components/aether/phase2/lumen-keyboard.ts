/**
 * Lumen keyboard navigation — re-export from `@app/aether-canvas-shared`.
 *
 * Implementation moved to the shared package in AE478 so the Phase 4
 * native Lumen (which uses gesture handlers but still wants the same
 * directional traversal math) can reuse the helpers. This file remains
 * so existing imports keep working.
 */
export {
  arrowDirectionFromKey,
  lumenFocusAnnouncement,
  nextPhotoInDirection,
  type LumenArrowDirection,
} from '@app/aether-canvas-shared';
