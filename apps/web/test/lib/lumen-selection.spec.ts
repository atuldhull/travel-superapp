/** Vitest specs for AE402 Lumen selection helpers. */
import { describe, expect, it } from 'vitest';
import {
  LUMEN_OVERVIEW_TARGET,
  cameraTargetForPhoto,
  planeOpacityForFocus,
  planeScaleForFocus,
  resolveLumenCameraTarget,
} from '../../src/components/aether/phase2/lumen-selection';
import type { LumenPlaneLayout } from '../../src/components/aether/phase2/lumen-cloud';

function plane(id: string, position: [number, number, number]): LumenPlaneLayout {
  return { id, position, size: 1.6, url: null };
}

describe('LUMEN_OVERVIEW_TARGET (pure)', () => {
  it('frames the cloud at z=12 looking at origin', () => {
    expect(LUMEN_OVERVIEW_TARGET.position).toEqual([0, 0, 12]);
    expect(LUMEN_OVERVIEW_TARGET.lookAt).toEqual([0, 0, 0]);
  });
});

describe('cameraTargetForPhoto (pure)', () => {
  it('dollies the camera in front of the plane', () => {
    const p = plane('a', [3, 2, -1]);
    const out = cameraTargetForPhoto(p, 2.4);
    expect(out.position).toEqual([3, 2, -1 + 2.4]);
    expect(out.lookAt).toEqual([3, 2, -1]);
  });
  it('honours custom dolly distance', () => {
    const p = plane('a', [0, 0, 0]);
    const out = cameraTargetForPhoto(p, 5);
    expect(out.position[2]).toBe(5);
  });
});

describe('resolveLumenCameraTarget (pure)', () => {
  const planes = [plane('a', [1, 0, 0]), plane('b', [-1, 0, 0])];

  it('null focus → overview', () => {
    expect(resolveLumenCameraTarget(null, planes)).toEqual(LUMEN_OVERVIEW_TARGET);
  });
  it('unknown focus id → overview (safe fallback)', () => {
    expect(resolveLumenCameraTarget('missing', planes)).toEqual(LUMEN_OVERVIEW_TARGET);
  });
  it('known focus → dolly to that plane', () => {
    const out = resolveLumenCameraTarget('a', planes);
    expect(out.position).toEqual([1, 0, 2.4]);
    expect(out.lookAt).toEqual([1, 0, 0]);
  });
});

describe('planeOpacityForFocus (pure)', () => {
  it('overview → 1.0 for every plane', () => {
    expect(planeOpacityForFocus('a', null)).toBe(1);
    expect(planeOpacityForFocus('b', null)).toBe(1);
  });
  it('focused plane → 1.0', () => {
    expect(planeOpacityForFocus('a', 'a')).toBe(1);
  });
  it('unfocused planes → dim default 0.18', () => {
    expect(planeOpacityForFocus('b', 'a')).toBe(0.18);
  });
  it('custom dim amount honoured', () => {
    expect(planeOpacityForFocus('b', 'a', 0.5)).toBe(0.5);
  });
});

describe('planeScaleForFocus (pure)', () => {
  it('overview → 1.0 for every plane', () => {
    expect(planeScaleForFocus('a', null)).toBe(1);
  });
  it('focused plane bumps up to 1.06', () => {
    expect(planeScaleForFocus('a', 'a')).toBe(1.06);
  });
  it('unfocused planes scale down to 0.92', () => {
    expect(planeScaleForFocus('b', 'a')).toBe(0.92);
  });
});
