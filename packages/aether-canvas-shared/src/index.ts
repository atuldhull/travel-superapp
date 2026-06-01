/**
 * @app/aether-canvas-shared — pure helpers consumed by both the web
 * canvas package (`@app/aether-canvas`) and the Phase 4 native canvas
 * package (`@app/aether-canvas/native`).
 *
 * Everything exported here MUST be framework-free: no React, no DOM,
 * no Three.js, no R3F. Only depends on type-only imports from
 * `@app/aether-core` (e.g. `SurfaceLifecyclePhase`).
 */

export const AETHER_CANVAS_SHARED_VERSION = '0.0.1';

// AE454 — lifecycle progress + camera-pose math.
export {
  DEFAULT_PHASE_DURATIONS,
  easeInCubic,
  easeOutCubic,
  easedPhaseProgress,
  isPhaseComplete,
  phaseProgress,
  __testing,
  type LifecyclePhaseDurations,
} from './lifecycle-progress';

export {
  DEFAULT_CAMERA_SCRIPT,
  cameraPoseAt,
  lerp,
  lerpVec3,
  previousPoseFor,
  type CameraPose,
  type CameraScript,
  type Vec3Tuple,
} from './lifecycle-camera';

// AE455 — Pulse breathing envelopes.
export {
  moodFromPhase,
  pulseBreathAt,
  pulseBreathParams,
  pulseBreathStatic,
  type PulseBreathParams,
  type PulseBreathState,
  type PulseMood,
} from './pulse-breathing';

// AE456 — spatial layout math (Atlas / Compass / Lumen / Vault / Echo).
export {
  DEFAULT_ATLAS_LAYOUT,
  dayPositionOnAxis,
  layoutDayMarkers,
  layoutOrbsForTrip,
  orbColorForItem,
  orbSizeForItem,
  orbZForSlot,
  type AtlasDayLike,
  type AtlasItemLike,
  type AtlasLayoutConfig,
  type DayMarkerLayout,
  type OrbLayout,
} from './atlas-orbs';

export {
  CARDINALS,
  angularDistance,
  bearingPositionOnRing,
  bearingToVec3,
  cardinalAt,
  normalizeBearing,
  type CompassPosition,
} from './compass-rose';

export {
  DEFAULT_LUMEN_LAYOUT,
  clampRating,
  jitterZFor,
  layoutPhotoCloud,
  ratingToY,
  sortPhotosByTime,
  timeToX,
  type LumenLayoutConfig,
  type LumenPhotoLike,
  type LumenPlaneLayout,
} from './lumen-cloud';

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
} from './vault-glyph-positions';

export {
  ECHO_CARD_HEIGHT,
  ECHO_CARD_SPACING_Y,
  ECHO_CARD_WIDTH,
  echoCardOpacity,
  echoCardScale,
  echoCardVisible,
  echoCardY,
  visibleEchoSlots,
} from './echo-layout';

// AE457 — weather + Now Card + destination coords.
export {
  simulatedWeatherFor,
  weatherForSlugMonth,
  weatherHasParticles,
  weatherStreakCount,
  weatherStreakIntensity,
  type MonthZeroIndexed,
  type WeatherState,
} from './weather-simulation';

export {
  nowCardContent,
  nowCardContentNow,
  timeBandFor,
  type NowCardContent,
  type TimeBand,
} from './now-card-content';

export {
  coordsForDestination,
  curatedCoordSlugs,
  type DestinationCoords,
} from './destination-coords';

// AE469 — Genie state machine + particle dissolution + camera + recorder.
export {
  genieIsActive,
  genieMicAriaLabel,
  genieMicRingColor,
  genieOnError,
  genieOnMicPress,
  genieOnMicRelease,
  genieOnStt,
  genieReset,
  genieStateLabel,
  type GenieState,
} from './genie-state';

export {
  GENIE_DISSOLVE_MS,
  GENIE_PARTICLE_BASE_RADIUS,
  GENIE_PARTICLE_COUNT,
  canvasDimensions,
  easeInOutCubic,
  particleAt,
  particleInitialPosition,
  particleRadius,
  particleRestOpacity,
  particleRestPosition,
} from './genie-particles';

export {
  DEFAULT_CAMERA_FACING_MODE,
  DEFAULT_CAPTURE_QUALITY,
  DETECTION_PLACEHOLDER_LABEL,
  GENIE_CAPTURE_MODES,
  cameraStatusLabel,
  canCaptureStill,
  canStartCamera,
  captureModeDescription,
  captureModeGlyph,
  captureModeLabel,
  formatDetectionLabel,
  isCameraStreaming,
  type GenieCameraStatus,
  type GenieCaptureMode,
} from './genie-camera';

export {
  MAX_RECORDING_MS,
  RECORDER_MIME_PREFERENCES,
  RECORDER_TICK_MS,
  canStartRecording,
  formatRecordingDuration,
  genieMimeExtension,
  isRecorderBusy,
  pickAudioMimeType,
  recorderStatusLabel,
  shouldAutoStop,
  type GenieRecorderStatus,
} from './genie-recorder';

// AE470 — Continuum URL state + sigil grid + receiver landing.
export {
  CONTINUUM_QUERY_KEY,
  buildContinuumUrl,
  continuumSigilSeed,
  isContinuumUrl,
  parseContinuumUrl,
  type ContinuumExtras,
  type ContinuumState,
} from './continuum-state';

export {
  DEFAULT_SIGIL_SIZE,
  buildSigilGrid,
  hashSeed,
  sigilEquals,
  sigilFilledCount,
  type SigilGrid,
} from './continuum-sigil';

export {
  NO_CONTINUUM_LANDING,
  formatContinuumLandingMessage,
  readContinuumLanding,
  type ContinuumLanding,
} from './continuum-landing';

// AE471 — Mirror admin globe + audit-river + Cmd+K investigation helpers.
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
} from './mirror-globe';

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
} from './mirror-investigate';

// AE477 — Echo feed + Live trip-watch (Phase 3 remainders).
export {
  ECHO_SWIPE_NOISE_PX,
  boostHexColor,
  echoActionForSwipe,
  echoPaletteFromDominantColor,
  echoSwipeDirectionFromDelta,
  formatEchoPostedAt,
  nextEchoIndex,
  type EchoAction,
  type EchoItem,
  type EchoSwipeDirection,
} from './echo-feed';

export {
  LIVE_FRESHNESS_MS,
  STALE_THRESHOLD_MS,
  presenceAgoLabel,
  presenceAnnouncement,
  presenceDotColor,
  presenceFreshness,
  presenceFreshnessLabel,
  presenceModeGlyph,
  presenceSpeedLabel,
  type LiveTripFreshness,
  type LiveTripPresence,
} from './live-trip-watch';

// AE478 — Lumen interactions (museum / pinch / strategies / selection / keyboard).
export {
  DEFAULT_MUSEUM_ARC,
  museumArcPositions,
  resolveMuseumTarget,
  type MuseumArcConfig,
} from './lumen-museum';

export {
  PINCH_DELTA_THRESHOLD,
  nearestPlaneToCenter,
  nextFocusForPinch,
  wheelToPinchIntent,
  type LumenPinchIntent,
  type LumenPinchWheelEvent,
} from './lumen-pinch';

export {
  LUMEN_LAYOUT_STRATEGIES,
  applyLayoutStrategy,
  isStrategyImplemented,
  layoutByGrid,
  layoutByMoodStub,
  layoutBySpiral,
  layoutByWall,
  layoutStrategyDescription,
  layoutStrategyLabel,
  type LumenLayoutStrategy,
} from './lumen-strategies';

export {
  LUMEN_OVERVIEW_TARGET,
  cameraTargetForPhoto,
  planeOpacityForFocus,
  planeScaleForFocus,
  resolveLumenCameraTarget,
  type LumenCameraTarget,
} from './lumen-selection';

export {
  arrowDirectionFromKey,
  lumenFocusAnnouncement,
  nextPhotoInDirection,
  type LumenArrowDirection,
} from './lumen-keyboard';

// AE479 — Vault price model + checkout state + sample fixtures +
// Pulse hold-to-talk gesture FSM + presigned URL TTL helpers.
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
} from './vault-glyphs';

export {
  CHECKOUT_NAME_MIN_LENGTH,
  VAULT_CHECKOUT_SIMULATED_DELAY_MS,
  canSubmitCheckout,
  checkoutDisabledReason,
  checkoutFooterCopy,
  checkoutStatusLabel,
  checkoutSubmitLabel,
  checkoutTitle,
  checkoutTotal,
  validateCheckoutEmail,
  validateCheckoutName,
  type VaultCheckoutStatus,
} from './vault-checkout';

export {
  SAMPLE_VAULT_MAX_AMOUNT,
  SAMPLE_VAULT_MIN_AMOUNT,
  SAMPLE_VAULT_PRICES,
} from './vault-sample-prices';

export {
  PULSE_HOLD_THRESHOLD_MS,
  holdStatusLabel,
  isHoldGesture,
  nextHoldStatus,
  pulseReleaseOutcome,
  type PulseHoldStatus,
  type PulseReleaseOutcome,
} from './pulse-hold-to-talk';

export {
  DEFAULT_TTL_REFETCH_MARGIN_MS,
  isExpiryNear,
  msUntilExpiry,
  refetchDelayMs,
} from './url-ttl';
