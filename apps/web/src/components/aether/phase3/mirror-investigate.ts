/**
 * Mirror Cmd+K investigation helpers — re-export from `@app/aether-canvas-shared`.
 *
 * Implementation moved to the shared package in AE471 so the Phase 4
 * native Mirror admin reuses identical user-suggestion filtering +
 * severity tiering + Cmd+K hotkey detection. This file remains so
 * existing imports keep working.
 */
export {
  filterUserSuggestions,
  formatInvestigationCount,
  highlightRange,
  investigationAnnouncement,
  investigationSeverity,
  isInvestigationHotkey,
  type MirrorInvestigation,
  type MirrorInvestigationSeverity,
  type MirrorUserSuggestion,
} from '@app/aether-canvas-shared';
