/**
 * AE473 — Phase 1 API surface shape-gate.
 *
 * The Phase 1 barrel (`apps/web/src/components/aether/phase1/index.ts`) is
 * the public surface every other apps/web file imports from. Renaming or
 * accidentally dropping an export from this barrel is a silent break
 * waiting to bite the next consumer that re-exports through it
 * (Storybook fixtures, jsdom integration specs, the Phase 4 native
 * package, etc.).
 *
 * This spec is a coverage tripwire: it imports the barrel as a namespace,
 * asserts each function-shaped export is callable (`typeof === 'function'`),
 * and checks each constant has the expected shape. The actual behaviour
 * of each helper is covered in its own paired spec — this one only
 * guards the presence + arity of the exports.
 *
 * Why the vi.mock calls at the top: the barrel transitively imports
 * `@app/sdk` via `phase1-atlas-shell.tsx` (for `useAetherTripList`) +
 * `upcoming-trip-context.tsx`, and that in turn pulls in
 * `@tanstack/react-query`. Vitest doesn't have either of those wired
 * for this shape-gate, so we stub them with no-op proxies + objects so
 * the barrel resolves and we can inspect what it exports. Behaviour of
 * the hooks that consume those mocks is verified elsewhere (with real
 * QueryClient + SDK fixtures).
 *
 * Round AK deferred this work as "AE460"; landed here as AE473.
 */
import { describe, expect, it, vi } from 'vitest';

// Stub @app/sdk so the barrel's transitive import resolves. Proxy
// returns a no-op function for every property access so anything the
// barrel touches at module-load time becomes a valid callable / object.
vi.mock('@app/sdk', () => new Proxy({}, { get: () => () => undefined }));

// Stub @tanstack/react-query so hooks that close over useQuery /
// useMutation / useQueryClient at module-load don't blow up. Returning
// the canonical shape lets any "if (result.isPending) ..." branch in a
// hook body stay sound during module evaluation.
vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: undefined, isPending: false, isError: false }),
  useMutation: () => ({ mutate: () => undefined, isPending: false }),
  useQueryClient: () => ({ invalidateQueries: () => undefined }),
}));

// Import the barrel as a namespace AFTER the mocks above are wired.
import * as Phase1 from '../../src/components/aether/phase1';

describe('Phase 1 barrel — shells + registry', () => {
  it('exports Phase1DriftShell as a function (React component)', () => {
    expect(typeof Phase1.Phase1DriftShell).toBe('function');
  });

  it('exports Phase1AtlasShell as a function (React component)', () => {
    expect(typeof Phase1.Phase1AtlasShell).toBe('function');
  });

  it('exports Phase1CompassShell as a function (React component)', () => {
    expect(typeof Phase1.Phase1CompassShell).toBe('function');
  });

  it('exports createAetherPhase1Registry as a function', () => {
    expect(typeof Phase1.createAetherPhase1Registry).toBe('function');
  });

  it('exports Phase1DevNav as a function (React component)', () => {
    expect(typeof Phase1.Phase1DevNav).toBe('function');
  });
});

describe('Phase 1 barrel — lifecycle helpers', () => {
  it('exports DEFAULT_LIFECYCLE_PLAN with the four phase durations', () => {
    const plan = Phase1.DEFAULT_LIFECYCLE_PLAN;
    expect(typeof plan).toBe('object');
    expect(typeof plan.idleHoldMs).toBe('number');
    expect(typeof plan.materialisingMs).toBe('number');
    expect(typeof plan.settlingMs).toBe('number');
    expect(typeof plan.dissolvingMs).toBe('number');
    // The default plan deliberately has NO listening hold — the FSM
    // stops at `listening` until external code advances it.
    expect(plan.listeningHoldMs).toBeUndefined();
  });

  it('exports BREATHING_LIFECYCLE_PLAN with a listening hold', () => {
    const plan = Phase1.BREATHING_LIFECYCLE_PLAN;
    expect(typeof plan).toBe('object');
    expect(typeof plan.listeningHoldMs).toBe('number');
    expect(plan.listeningHoldMs).toBeGreaterThan(0);
  });

  it('exports nextPhaseInChain as a function', () => {
    expect(typeof Phase1.nextPhaseInChain).toBe('function');
  });

  it('exports nextScheduledPhase as a function', () => {
    expect(typeof Phase1.nextScheduledPhase).toBe('function');
  });

  it('exports phaseDelayFor as a function', () => {
    expect(typeof Phase1.phaseDelayFor).toBe('function');
  });

  it('exports useLifecycleAutoDriver as a function (React hook)', () => {
    expect(typeof Phase1.useLifecycleAutoDriver).toBe('function');
  });

  it('exports useLifecycleEvents as a function (React hook)', () => {
    expect(typeof Phase1.useLifecycleEvents).toBe('function');
  });

  it('exports handlerKeyForPhase as a function', () => {
    expect(typeof Phase1.handlerKeyForPhase).toBe('function');
  });
});

describe('Phase 1 barrel — atlas layout', () => {
  it('exports DEFAULT_ATLAS_LAYOUT with the axisLength scalar', () => {
    const layout = Phase1.DEFAULT_ATLAS_LAYOUT;
    expect(typeof layout).toBe('object');
    expect(typeof layout.axisLength).toBe('number');
    expect(layout.axisLength).toBeGreaterThan(0);
  });

  it('exports layoutOrbsForTrip as a function', () => {
    expect(typeof Phase1.layoutOrbsForTrip).toBe('function');
  });

  it('exports layoutDayMarkers as a function', () => {
    expect(typeof Phase1.layoutDayMarkers).toBe('function');
  });

  it('exports dayPositionOnAxis as a function', () => {
    expect(typeof Phase1.dayPositionOnAxis).toBe('function');
  });

  it('exports orbColorForItem as a function', () => {
    expect(typeof Phase1.orbColorForItem).toBe('function');
  });

  it('exports orbSizeForItem as a function', () => {
    expect(typeof Phase1.orbSizeForItem).toBe('function');
  });

  it('exports orbZForSlot as a function', () => {
    expect(typeof Phase1.orbZForSlot).toBe('function');
  });
});

describe('Phase 1 barrel — compass rose', () => {
  it('exports CARDINALS as an array of the four cardinal points', () => {
    expect(Array.isArray(Phase1.CARDINALS)).toBe(true);
    expect(Phase1.CARDINALS.length).toBe(4);
  });

  it('exports angularDistance as a function', () => {
    expect(typeof Phase1.angularDistance).toBe('function');
  });

  it('exports bearingPositionOnRing as a function', () => {
    expect(typeof Phase1.bearingPositionOnRing).toBe('function');
  });

  it('exports bearingToVec3 as a function', () => {
    expect(typeof Phase1.bearingToVec3).toBe('function');
  });

  it('exports cardinalAt as a function', () => {
    expect(typeof Phase1.cardinalAt).toBe('function');
  });

  it('exports normalizeBearing as a function', () => {
    expect(typeof Phase1.normalizeBearing).toBe('function');
  });

  it('exports CompassBearingProvider as a function (React component)', () => {
    expect(typeof Phase1.CompassBearingProvider).toBe('function');
  });

  it('exports useCompassBearing as a function (React hook)', () => {
    expect(typeof Phase1.useCompassBearing).toBe('function');
  });
});

describe('Phase 1 barrel — now card', () => {
  it('exports nowCardContent as a function', () => {
    expect(typeof Phase1.nowCardContent).toBe('function');
  });

  it('exports nowCardContentNow as a function', () => {
    expect(typeof Phase1.nowCardContentNow).toBe('function');
  });

  it('exports timeBandFor as a function', () => {
    expect(typeof Phase1.timeBandFor).toBe('function');
  });

  it('exports DriftNowCard as a function (React component)', () => {
    expect(typeof Phase1.DriftNowCard).toBe('function');
  });

  it('exports DEFAULT_NOW_CARD_DURATIONS with the three phase durations', () => {
    const d = Phase1.DEFAULT_NOW_CARD_DURATIONS;
    expect(typeof d).toBe('object');
    expect(typeof d.materialisingMs).toBe('number');
    expect(typeof d.settlingMs).toBe('number');
    expect(typeof d.dissolvingMs).toBe('number');
  });

  it('exports nowCardOpacityForPhase as a function', () => {
    expect(typeof Phase1.nowCardOpacityForPhase).toBe('function');
  });

  it('exports nowCardScaleForPhase as a function', () => {
    expect(typeof Phase1.nowCardScaleForPhase).toBe('function');
  });

  it('exports nowCardTransitionMs as a function', () => {
    expect(typeof Phase1.nowCardTransitionMs).toBe('function');
  });

  it('exports nowCardCssForPhase as a function', () => {
    expect(typeof Phase1.nowCardCssForPhase).toBe('function');
  });
});

describe('Phase 1 barrel — continuum', () => {
  it("exports CONTINUUM_QUERY_KEY as the literal 'aether-continuum'", () => {
    expect(Phase1.CONTINUUM_QUERY_KEY).toBe('aether-continuum');
  });

  it('exports buildContinuumUrl as a function', () => {
    expect(typeof Phase1.buildContinuumUrl).toBe('function');
  });

  it('exports parseContinuumUrl as a function', () => {
    expect(typeof Phase1.parseContinuumUrl).toBe('function');
  });

  it('exports isContinuumUrl as a function', () => {
    expect(typeof Phase1.isContinuumUrl).toBe('function');
  });

  it('exports continuumSigilSeed as a function', () => {
    expect(typeof Phase1.continuumSigilSeed).toBe('function');
  });

  it('exports DEFAULT_SIGIL_SIZE as a positive integer (21, QR v1)', () => {
    expect(typeof Phase1.DEFAULT_SIGIL_SIZE).toBe('number');
    expect(Phase1.DEFAULT_SIGIL_SIZE).toBe(21);
  });

  it('exports buildSigilGrid as a function', () => {
    expect(typeof Phase1.buildSigilGrid).toBe('function');
  });

  it('exports hashSeed as a function', () => {
    expect(typeof Phase1.hashSeed).toBe('function');
  });

  it('exports sigilEquals as a function', () => {
    expect(typeof Phase1.sigilEquals).toBe('function');
  });

  it('exports sigilFilledCount as a function', () => {
    expect(typeof Phase1.sigilFilledCount).toBe('function');
  });

  it('exports Phase1ContinuumBar as a function (React component)', () => {
    expect(typeof Phase1.Phase1ContinuumBar).toBe('function');
  });

  it('exports NO_CONTINUUM_LANDING with isHandoff=false + frozen extras', () => {
    const empty = Phase1.NO_CONTINUUM_LANDING;
    expect(empty.isHandoff).toBe(false);
    expect(typeof empty.extras).toBe('object');
    expect(Object.isFrozen(empty)).toBe(true);
  });

  it('exports readContinuumLanding as a function', () => {
    expect(typeof Phase1.readContinuumLanding).toBe('function');
  });

  it('exports formatContinuumLandingMessage as a function', () => {
    expect(typeof Phase1.formatContinuumLandingMessage).toBe('function');
  });

  it('exports useContinuumLanding as a function (React hook)', () => {
    expect(typeof Phase1.useContinuumLanding).toBe('function');
  });

  it('exports Phase1ContinuumReceiverToast as a function (React component)', () => {
    expect(typeof Phase1.Phase1ContinuumReceiverToast).toBe('function');
  });
});

describe('Phase 1 barrel — weather', () => {
  it('exports simulatedWeatherFor as a function', () => {
    expect(typeof Phase1.simulatedWeatherFor).toBe('function');
  });

  it('exports weatherForSlugMonth as a function', () => {
    expect(typeof Phase1.weatherForSlugMonth).toBe('function');
  });

  it('exports weatherHasParticles as a function', () => {
    expect(typeof Phase1.weatherHasParticles).toBe('function');
  });

  it('exports weatherStreakCount as a function', () => {
    expect(typeof Phase1.weatherStreakCount).toBe('function');
  });

  it('exports weatherStreakIntensity as a function', () => {
    expect(typeof Phase1.weatherStreakIntensity).toBe('function');
  });

  it('exports WeatherProvider as a function (React component)', () => {
    expect(typeof Phase1.WeatherProvider).toBe('function');
  });

  it('exports useWeather as a function (React hook)', () => {
    expect(typeof Phase1.useWeather).toBe('function');
  });

  it('exports useRealWeather as a function (React hook)', () => {
    expect(typeof Phase1.useRealWeather).toBe('function');
  });

  it('exports isoDateOnly as a function', () => {
    expect(typeof Phase1.isoDateOnly).toBe('function');
  });

  it('exports openMeteoUrl as a function', () => {
    expect(typeof Phase1.openMeteoUrl).toBe('function');
  });

  it('exports parseOpenMeteoDaily as a function', () => {
    expect(typeof Phase1.parseOpenMeteoDaily).toBe('function');
  });

  it('exports weatherCodeToState as a function', () => {
    expect(typeof Phase1.weatherCodeToState).toBe('function');
  });
});

describe('Phase 1 barrel — destination coords', () => {
  it('exports coordsForDestination as a function', () => {
    expect(typeof Phase1.coordsForDestination).toBe('function');
  });

  it('exports curatedCoordSlugs as a function', () => {
    expect(typeof Phase1.curatedCoordSlugs).toBe('function');
  });
});

describe('Phase 1 barrel — pulse breathing', () => {
  it('exports moodFromPhase as a function', () => {
    expect(typeof Phase1.moodFromPhase).toBe('function');
  });

  it('exports pulseBreathAt as a function', () => {
    expect(typeof Phase1.pulseBreathAt).toBe('function');
  });

  it('exports pulseBreathParams as a function', () => {
    expect(typeof Phase1.pulseBreathParams).toBe('function');
  });

  it('exports pulseBreathStatic as a function', () => {
    expect(typeof Phase1.pulseBreathStatic).toBe('function');
  });

  it('exports Phase1PulseOverlay as a function (React component)', () => {
    expect(typeof Phase1.Phase1PulseOverlay).toBe('function');
  });

  it('exports Phase1PulseOverlayStandalone as a function (React component)', () => {
    expect(typeof Phase1.Phase1PulseOverlayStandalone).toBe('function');
  });
});

describe('Phase 1 barrel — dissolving link / navigate', () => {
  it('exports DEFAULT_DISSOLVE_MS as 500ms (matches AE375/AE382)', () => {
    expect(typeof Phase1.DEFAULT_DISSOLVE_MS).toBe('number');
    expect(Phase1.DEFAULT_DISSOLVE_MS).toBe(500);
  });

  it('exports delayedNavigate as a function', () => {
    expect(typeof Phase1.delayedNavigate).toBe('function');
  });

  it('exports useDissolvingNavigate as a function (React hook)', () => {
    expect(typeof Phase1.useDissolvingNavigate).toBe('function');
  });

  it('exports DissolvingLink as a function (React component)', () => {
    expect(typeof Phase1.DissolvingLink).toBe('function');
  });

  it('exports isInAppClick as a function', () => {
    expect(typeof Phase1.isInAppClick).toBe('function');
  });
});

describe('Phase 1 barrel — upcoming trip + trip data', () => {
  it('exports daysUntil as a function', () => {
    expect(typeof Phase1.daysUntil).toBe('function');
  });

  it('exports nowCardPersonalised as a function', () => {
    expect(typeof Phase1.nowCardPersonalised).toBe('function');
  });

  it('exports pickUpcomingTrip as a function', () => {
    expect(typeof Phase1.pickUpcomingTrip).toBe('function');
  });

  it('exports UpcomingTripProvider as a function (React component)', () => {
    expect(typeof Phase1.UpcomingTripProvider).toBe('function');
  });

  it('exports useUpcomingTrip as a function (React hook)', () => {
    expect(typeof Phase1.useUpcomingTrip).toBe('function');
  });

  it('exports TripDataProvider as a function (React component)', () => {
    expect(typeof Phase1.TripDataProvider).toBe('function');
  });

  it('exports useTripData as a function (React hook)', () => {
    expect(typeof Phase1.useTripData).toBe('function');
  });
});
