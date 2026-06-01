/**
 * AE488 — Phase 3 API surface shape-gate.
 *
 * Mirrors AE483 + AE484 for the new Phase 3 barrel
 * (`apps/web/src/components/aether/phase3/index.ts`). The Phase 3
 * surfaces (Echo social feed + Mirror admin forensics + live
 * trip-watch) ship many of their pure helpers via re-export shims
 * to `@app/aether-canvas-shared`; this spec guards against silent
 * breaks on a barrel rename.
 *
 * Coverage tripwire — checks every named export resolves to a
 * function or expected-shape constant. Behaviour is tested
 * per-module elsewhere.
 */
import { describe, expect, it, vi } from 'vitest';

// Phase 3 barrel transitively imports @app/sdk via the shell + react-
// query as a downstream dep. Stub both so the barrel resolves.
vi.mock('@app/sdk', () => new Proxy({}, { get: () => () => undefined }));
vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: undefined, isPending: false, isError: false }),
  useMutation: () => ({ mutate: () => undefined, isPending: false }),
  useQueryClient: () => ({ invalidateQueries: () => undefined }),
}));

import * as Phase3 from '../../src/components/aether/phase3';

describe('AE488 — Phase 3 API surface · Echo (social feed)', () => {
  it('exports the Echo swipe + palette derivation helpers', () => {
    expect(typeof Phase3.ECHO_SWIPE_NOISE_PX).toBe('number');
    expect(typeof Phase3.boostHexColor).toBe('function');
    expect(typeof Phase3.echoActionForSwipe).toBe('function');
    expect(typeof Phase3.echoPaletteFromDominantColor).toBe('function');
    expect(typeof Phase3.echoSwipeDirectionFromDelta).toBe('function');
    expect(typeof Phase3.formatEchoPostedAt).toBe('function');
    expect(typeof Phase3.nextEchoIndex).toBe('function');
  });
  it('exports the Echo card layout helpers + constants', () => {
    expect(typeof Phase3.ECHO_CARD_HEIGHT).toBe('number');
    expect(typeof Phase3.ECHO_CARD_SPACING_Y).toBe('number');
    expect(typeof Phase3.ECHO_CARD_WIDTH).toBe('number');
    expect(typeof Phase3.echoCardOpacity).toBe('function');
    expect(typeof Phase3.echoCardScale).toBe('function');
    expect(typeof Phase3.echoCardVisible).toBe('function');
    expect(typeof Phase3.echoCardY).toBe('function');
    expect(typeof Phase3.visibleEchoSlots).toBe('function');
  });
  it('exports the Echo context + sample fixtures + shell', () => {
    expect(typeof Phase3.EchoFeedProvider).toBe('function');
    expect(typeof Phase3.useEchoFeed).toBe('function');
    expect(Array.isArray(Phase3.SAMPLE_ECHO_FEED)).toBe(true);
    expect(Phase3.SAMPLE_ECHO_FEED.length).toBeGreaterThanOrEqual(5);
    expect(typeof Phase3.Phase3EchoShell).toBe('function');
  });
  it('exports the Echo swipe hook + throttle constant', () => {
    expect(typeof Phase3.ECHO_WHEEL_THROTTLE_MS).toBe('number');
    expect(typeof Phase3.useEchoSwipe).toBe('function');
  });
});

describe('AE488 — Phase 3 API surface · Mirror (admin forensics)', () => {
  it('exports the Mirror globe geometry + audit-river helpers', () => {
    expect(typeof Phase3.MIRROR_AUDIT_RIVER_TTL_MS).toBe('number');
    expect(typeof Phase3.MIRROR_GLOBE_RADIUS).toBe('number');
    expect(typeof Phase3.auditGlyphColor).toBe('function');
    expect(typeof Phase3.auditGlyphSymbol).toBe('function');
    expect(typeof Phase3.auditRowYProgress).toBe('function');
    expect(typeof Phase3.isMirrorViewer).toBe('function');
    expect(typeof Phase3.latLngToVec3).toBe('function');
    expect(typeof Phase3.liveAuditRows).toBe('function');
    expect(typeof Phase3.scamClusterRadius).toBe('function');
    expect(typeof Phase3.sosDotRadius).toBe('function');
  });
  it('exports the Mirror investigation helpers', () => {
    expect(typeof Phase3.filterUserSuggestions).toBe('function');
    expect(typeof Phase3.formatInvestigationCount).toBe('function');
    expect(typeof Phase3.highlightRange).toBe('function');
    expect(typeof Phase3.investigationAnnouncement).toBe('function');
    expect(typeof Phase3.investigationSeverity).toBe('function');
    expect(typeof Phase3.isInvestigationHotkey).toBe('function');
  });
  it('exports the Mirror chrome components + fixtures', () => {
    expect(typeof Phase3.MirrorInvestigatePalette).toBe('function');
    expect(typeof Phase3.MirrorAuditRiver).toBe('function');
    expect(typeof Phase3.Phase3MirrorShell).toBe('function');
    expect(Array.isArray(Phase3.SAMPLE_MIRROR_SOS)).toBe(true);
    expect(Array.isArray(Phase3.SAMPLE_MIRROR_SCAM)).toBe(true);
    expect(Array.isArray(Phase3.SAMPLE_MIRROR_AUDIT)).toBe(true);
    expect(Array.isArray(Phase3.SAMPLE_MIRROR_USERS)).toBe(true);
    expect(Phase3.SAMPLE_MIRROR_INVESTIGATIONS).toBeDefined();
  });
});

describe('AE488 — Phase 3 API surface · Live trip-watch (Tier 4 T4-Ag.2)', () => {
  it('exports presence freshness helpers + thresholds', () => {
    expect(typeof Phase3.LIVE_FRESHNESS_MS).toBe('number');
    expect(typeof Phase3.STALE_THRESHOLD_MS).toBe('number');
    expect(typeof Phase3.presenceAgoLabel).toBe('function');
    expect(typeof Phase3.presenceAnnouncement).toBe('function');
    expect(typeof Phase3.presenceDotColor).toBe('function');
    expect(typeof Phase3.presenceFreshness).toBe('function');
    expect(typeof Phase3.presenceFreshnessLabel).toBe('function');
    expect(typeof Phase3.presenceModeGlyph).toBe('function');
    expect(typeof Phase3.presenceSpeedLabel).toBe('function');
  });
  it('exports the LiveTripWatchOverlay component', () => {
    expect(typeof Phase3.LiveTripWatchOverlay).toBe('function');
  });
});
