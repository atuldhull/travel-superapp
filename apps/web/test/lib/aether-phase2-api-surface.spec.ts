/**
 * AE484 — Phase 2 API surface shape-gate.
 *
 * Mirrors AE483 for the Phase 2 barrel (`apps/web/src/components/aether/
 * phase2/index.ts`). Round AK+AL moved most Phase 2 pure helpers into
 * `@app/aether-canvas-shared`; the barrel still serves the same web
 * exports via re-export shims. This spec guards against a silent break
 * when a shim is renamed or dropped during a future refactor.
 *
 * Coverage tripwire — checks every named export resolves to a function
 * or expected-shape constant. Behaviour is tested per-module.
 */
import { describe, expect, it, vi } from 'vitest';

// Phase 2 barrel transitively imports @app/sdk via Phase2LumenShell +
// LumenPhotoSlot (useMediaControllerDownloadUrl + useMediaControllerListByTrip)
// and @tanstack/react-query through those hooks.
vi.mock('@app/sdk', () => new Proxy({}, { get: () => () => undefined }));
vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: undefined, isPending: false, isError: false }),
  useMutation: () => ({ mutate: () => undefined, isPending: false }),
  useQueryClient: () => ({ invalidateQueries: () => undefined }),
}));

import * as Phase2 from '../../src/components/aether/phase2';

describe('AE484 — Phase 2 API surface · Lumen', () => {
  it('exports the Lumen layout helpers + config', () => {
    expect(Phase2.DEFAULT_LUMEN_LAYOUT).toBeDefined();
    expect(typeof Phase2.DEFAULT_LUMEN_LAYOUT.axisLengthX).toBe('number');
    expect(typeof Phase2.clampRating).toBe('function');
    expect(typeof Phase2.jitterZFor).toBe('function');
    expect(typeof Phase2.layoutPhotoCloud).toBe('function');
    expect(typeof Phase2.ratingToY).toBe('function');
    expect(typeof Phase2.sortPhotosByTime).toBe('function');
    expect(typeof Phase2.timeToX).toBe('function');
  });
  it('exports Lumen shell + context + photo slot', () => {
    expect(typeof Phase2.LumenDataProvider).toBe('function');
    expect(typeof Phase2.useLumenData).toBe('function');
    expect(typeof Phase2.Phase2LumenShell).toBe('function');
    expect(typeof Phase2.LumenPhotoSlot).toBe('function');
  });
  it('exports Lumen selection helpers + provider', () => {
    expect(Phase2.LUMEN_OVERVIEW_TARGET).toBeDefined();
    expect(typeof Phase2.cameraTargetForPhoto).toBe('function');
    expect(typeof Phase2.planeOpacityForFocus).toBe('function');
    expect(typeof Phase2.planeScaleForFocus).toBe('function');
    expect(typeof Phase2.resolveLumenCameraTarget).toBe('function');
    expect(typeof Phase2.LumenSelectionProvider).toBe('function');
    expect(typeof Phase2.useLumenSelection).toBe('function');
  });
  it('exports Lumen keyboard navigation + announcer', () => {
    expect(typeof Phase2.arrowDirectionFromKey).toBe('function');
    expect(typeof Phase2.lumenFocusAnnouncement).toBe('function');
    expect(typeof Phase2.nextPhotoInDirection).toBe('function');
    expect(typeof Phase2.LumenFocusAnnouncer).toBe('function');
  });
});

describe('AE484 — Phase 2 API surface · Media download URL', () => {
  it('exports media-download-url extractors', () => {
    expect(typeof Phase2.extractDownloadUrl).toBe('function');
    expect(typeof Phase2.extractDownloadExpiresAt).toBe('function');
  });
});

describe('AE484 — Phase 2 API surface · URL TTL', () => {
  it('exports url-ttl helpers + hook', () => {
    expect(typeof Phase2.DEFAULT_TTL_REFETCH_MARGIN_MS).toBe('number');
    expect(typeof Phase2.isExpiryNear).toBe('function');
    expect(typeof Phase2.msUntilExpiry).toBe('function');
    expect(typeof Phase2.refetchDelayMs).toBe('function');
    expect(typeof Phase2.useUrlTtlRefetch).toBe('function');
  });
});

describe('AE484 — Phase 2 API surface · Genie', () => {
  it('exports the Genie state machine helpers', () => {
    expect(typeof Phase2.genieIsActive).toBe('function');
    expect(typeof Phase2.genieMicAriaLabel).toBe('function');
    expect(typeof Phase2.genieMicRingColor).toBe('function');
    expect(typeof Phase2.genieOnError).toBe('function');
    expect(typeof Phase2.genieOnMicPress).toBe('function');
    expect(typeof Phase2.genieOnMicRelease).toBe('function');
    expect(typeof Phase2.genieOnStt).toBe('function');
    expect(typeof Phase2.genieReset).toBe('function');
    expect(typeof Phase2.genieStateLabel).toBe('function');
  });
  it('exports the Genie modal component', () => {
    expect(typeof Phase2.Phase2GenieModal).toBe('function');
  });
});

describe('AE484 — Phase 2 API surface · Vault', () => {
  it('exports vault-glyphs helpers + config', () => {
    expect(Phase2.DEFAULT_VAULT_LAYOUT).toBeDefined();
    expect(typeof Phase2.formatMinorAmount).toBe('function');
    expect(typeof Phase2.glyphOpacity).toBe('function');
    expect(typeof Phase2.glyphSize).toBe('function');
    expect(typeof Phase2.priceDroppedRecently).toBe('function');
    expect(typeof Phase2.priceSparkline).toBe('function');
  });
  it('exports Phase2VaultShell', () => {
    expect(typeof Phase2.Phase2VaultShell).toBe('function');
  });
});
