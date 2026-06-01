/**
 * AE514 — barrel shape-gate for @app/aether-core-native.
 *
 * Verifies the package's public surface resolves: the re-export from
 * @app/aether-core works, the new SurfacePaletteSlotsContext + provider
 * are exported as functions/objects, and the version marker is in
 * place. Behavioural coverage for the Context + Provider lives in
 * sibling specs once the apps/mobile consumer mounts the provider.
 */
import * as Native from '../src';

describe('AE514 — @app/aether-core-native barrel', () => {
  it('exports the version marker', () => {
    expect(typeof Native.AETHER_CORE_NATIVE_VERSION).toBe('string');
    expect(Native.AETHER_CORE_NATIVE_VERSION.length).toBeGreaterThan(0);
  });

  it('exports the new SurfacePaletteSlotsContext (a React Context)', () => {
    expect(Native.SurfacePaletteSlotsContext).toBeDefined();
    // React Context shape: has Provider + Consumer + displayName.
    expect(typeof Native.SurfacePaletteSlotsContext.Provider).toBe('object');
    expect(Native.SurfacePaletteSlotsContext.displayName).toBe('SurfacePaletteSlotsContext');
  });

  it('exports the SurfacePaletteSlotsProvider component', () => {
    expect(typeof Native.SurfacePaletteSlotsProvider).toBe('function');
  });

  it('exports the useSurfacePaletteSlotsFromContext hook', () => {
    expect(typeof Native.useSurfacePaletteSlotsFromContext).toBe('function');
  });

  it('re-exports the @app/aether-core surface manager API', () => {
    // Smoke-test a handful of well-known exports from @app/aether-core.
    expect(typeof Native.SurfaceManagerProvider).toBe('function');
    expect(typeof Native.useCurrentSurface).toBe('function');
    expect(typeof Native.useSurfacePalette).toBe('function');
    expect(typeof Native.useSurfacePaletteSlots).toBe('function');
  });

  it('re-exports SurfacePaletteVars transparently (harmless no-op on RN)', () => {
    // SurfacePaletteVars writes CSS custom properties via the DOM.
    // Its effect guards `typeof document === 'undefined'` and no-ops
    // on RN. Re-exporting keeps the web migration ergonomic; native
    // consumers should prefer the SurfacePaletteSlotsProvider pair.
    expect(typeof Native.SurfacePaletteVars).toBe('function');
  });
});
