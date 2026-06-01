/**
 * Shape-gate spec for `@app/aether-canvas-shared` — tripwire that fires
 * if a named export disappears or changes name. Behaviour is tested at
 * each helper's own spec (in apps/web/test/lib/ or packages/aether-
 * canvas/test/), so this file only verifies presence + callability.
 */
import * as Shared from '../src';

describe('aether-canvas-shared · shape gate', () => {
  it('marker version is present', () => {
    expect(typeof Shared.AETHER_CANVAS_SHARED_VERSION).toBe('string');
  });

  it('AE454 — lifecycle progress + camera', () => {
    expect(typeof Shared.easeOutCubic).toBe('function');
    expect(typeof Shared.easeInCubic).toBe('function');
    expect(typeof Shared.phaseProgress).toBe('function');
    expect(typeof Shared.easedPhaseProgress).toBe('function');
    expect(typeof Shared.isPhaseComplete).toBe('function');
    expect(Shared.DEFAULT_PHASE_DURATIONS).toBeDefined();
    expect(typeof Shared.cameraPoseAt).toBe('function');
    expect(typeof Shared.lerp).toBe('function');
    expect(typeof Shared.lerpVec3).toBe('function');
    expect(typeof Shared.previousPoseFor).toBe('function');
    expect(Shared.DEFAULT_CAMERA_SCRIPT).toBeDefined();
  });

  it('AE455 — pulse breathing', () => {
    expect(typeof Shared.moodFromPhase).toBe('function');
    expect(typeof Shared.pulseBreathAt).toBe('function');
    expect(typeof Shared.pulseBreathParams).toBe('function');
    expect(typeof Shared.pulseBreathStatic).toBe('function');
  });

  it('AE456 — spatial layouts', () => {
    expect(typeof Shared.dayPositionOnAxis).toBe('function');
    expect(typeof Shared.orbZForSlot).toBe('function');
    expect(typeof Shared.layoutOrbsForTrip).toBe('function');
    expect(typeof Shared.bearingToVec3).toBe('function');
    expect(typeof Shared.normalizeBearing).toBe('function');
    expect(typeof Shared.cardinalAt).toBe('function');
    expect(Shared.CARDINALS.length).toBe(4);
    expect(typeof Shared.layoutPhotoCloud).toBe('function');
    expect(typeof Shared.glyphRingPosition).toBe('function');
    expect(typeof Shared.glyphFloatY).toBe('function');
    expect(typeof Shared.echoCardY).toBe('function');
    expect(typeof Shared.visibleEchoSlots).toBe('function');
  });

  it('AE457 — weather + now-card + destination-coords', () => {
    expect(typeof Shared.weatherForSlugMonth).toBe('function');
    expect(typeof Shared.simulatedWeatherFor).toBe('function');
    expect(typeof Shared.timeBandFor).toBe('function');
    expect(typeof Shared.nowCardContent).toBe('function');
    expect(typeof Shared.coordsForDestination).toBe('function');
    expect(Shared.curatedCoordSlugs().length).toBeGreaterThanOrEqual(8);
  });

  it('AE469 — Genie state + particles + camera + recorder', () => {
    expect(typeof Shared.genieStateLabel).toBe('function');
    expect(typeof Shared.genieMicRingColor).toBe('function');
    expect(typeof Shared.particleAt).toBe('function');
    expect(typeof Shared.canvasDimensions).toBe('function');
    expect(typeof Shared.captureModeLabel).toBe('function');
    expect(typeof Shared.formatRecordingDuration).toBe('function');
    expect(typeof Shared.genieMimeExtension).toBe('function');
  });

  it('AE470 — Continuum state + sigil + landing', () => {
    expect(typeof Shared.buildContinuumUrl).toBe('function');
    expect(typeof Shared.parseContinuumUrl).toBe('function');
    expect(typeof Shared.isContinuumUrl).toBe('function');
    expect(typeof Shared.buildSigilGrid).toBe('function');
    expect(typeof Shared.hashSeed).toBe('function');
    expect(typeof Shared.readContinuumLanding).toBe('function');
    expect(typeof Shared.formatContinuumLandingMessage).toBe('function');
    expect(Shared.NO_CONTINUUM_LANDING.isHandoff).toBe(false);
  });

  it('AE471 — Mirror globe + investigate', () => {
    expect(typeof Shared.latLngToVec3).toBe('function');
    expect(typeof Shared.sosDotRadius).toBe('function');
    expect(typeof Shared.scamClusterRadius).toBe('function');
    expect(typeof Shared.liveAuditRows).toBe('function');
    expect(typeof Shared.auditRowYProgress).toBe('function');
    expect(typeof Shared.isMirrorViewer).toBe('function');
    expect(typeof Shared.isInvestigationHotkey).toBe('function');
    expect(typeof Shared.filterUserSuggestions).toBe('function');
    expect(typeof Shared.investigationSeverity).toBe('function');
  });

  it('AE477 — Echo feed + Live trip-watch', () => {
    expect(typeof Shared.echoSwipeDirectionFromDelta).toBe('function');
    expect(typeof Shared.echoActionForSwipe).toBe('function');
    expect(typeof Shared.nextEchoIndex).toBe('function');
    expect(typeof Shared.boostHexColor).toBe('function');
    expect(typeof Shared.echoPaletteFromDominantColor).toBe('function');
    expect(typeof Shared.presenceFreshness).toBe('function');
    expect(typeof Shared.presenceFreshnessLabel).toBe('function');
    expect(typeof Shared.presenceAgoLabel).toBe('function');
    expect(typeof Shared.presenceModeGlyph).toBe('function');
  });

  it('AE478 — Lumen interactions', () => {
    expect(typeof Shared.museumArcPositions).toBe('function');
    expect(typeof Shared.wheelToPinchIntent).toBe('function');
    expect(typeof Shared.nextFocusForPinch).toBe('function');
    expect(typeof Shared.applyLayoutStrategy).toBe('function');
    expect(Shared.LUMEN_LAYOUT_STRATEGIES.length).toBe(5);
    expect(typeof Shared.cameraTargetForPhoto).toBe('function');
    expect(typeof Shared.nextPhotoInDirection).toBe('function');
    expect(typeof Shared.lumenFocusAnnouncement).toBe('function');
  });

  it('AE479 — Vault + Pulse hold-to-talk + url-ttl', () => {
    expect(typeof Shared.glyphSize).toBe('function');
    expect(typeof Shared.glyphOpacity).toBe('function');
    expect(typeof Shared.formatMinorAmount).toBe('function');
    expect(typeof Shared.priceSparkline).toBe('function');
    expect(typeof Shared.priceDroppedRecently).toBe('function');
    expect(typeof Shared.canSubmitCheckout).toBe('function');
    expect(typeof Shared.validateCheckoutEmail).toBe('function');
    expect(Array.isArray(Shared.SAMPLE_VAULT_PRICES)).toBe(true);
    expect(typeof Shared.isHoldGesture).toBe('function');
    expect(typeof Shared.pulseReleaseOutcome).toBe('function');
    expect(typeof Shared.msUntilExpiry).toBe('function');
    expect(typeof Shared.refetchDelayMs).toBe('function');
  });

  it('AE480 — Now Card lifecycle + upcoming trip', () => {
    expect(typeof Shared.nowCardOpacityForPhase).toBe('function');
    expect(typeof Shared.nowCardScaleForPhase).toBe('function');
    expect(typeof Shared.nowCardCssForPhase).toBe('function');
    expect(typeof Shared.daysUntil).toBe('function');
    expect(typeof Shared.pickUpcomingTrip).toBe('function');
    expect(typeof Shared.nowCardPersonalised).toBe('function');
  });
});
