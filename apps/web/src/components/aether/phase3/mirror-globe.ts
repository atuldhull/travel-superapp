/**
 * Mirror admin globe + audit-river math — re-export from `@app/aether-canvas-shared`.
 *
 * Implementation moved to the shared package in AE471 so the Phase 4
 * native Mirror admin renders identical globe geometry + audit-river
 * TTL math. This file remains so existing imports keep working.
 */
export {
  MIRROR_AUDIT_RIVER_TTL_MS,
  MIRROR_GLOBE_RADIUS,
  auditGlyphColor,
  auditGlyphSymbol,
  auditRowYProgress,
  isMirrorViewer,
  latLngToVec3,
  liveAuditRows,
  scamClusterRadius,
  sosDotRadius,
  type MirrorAuditRow,
  type MirrorSOSEvent,
  type MirrorScamCluster,
} from '@app/aether-canvas-shared';
