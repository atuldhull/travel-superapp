/**
 * AE505 â€” canvas-shared own behavioural spec for `lifecycle-camera`.
 *
 * The web-side spec at apps/web/test/lib/aether-lifecycle-camera.spec.ts pins
 * the consumer surface. This spec lives next to the module so the Phase 4
 * native port can re-export from `@app/aether-canvas-shared` and immediately
 * verify the same camera-pose interpolation without standing up the web
 * suite. Pairs to the docstring contracts in `src/lifecycle-camera.ts`.
 */
import {
  DEFAULT_CAMERA_SCRIPT,
  cameraPoseAt,
  lerp,
  lerpVec3,
  previousPoseFor,
  type CameraScript,
  type Vec3Tuple,
} from '../src';

describe('AE505 - lerp', () => {
  it('returns a at t=0', () => {
    expect(lerp(2, 10, 0)).toBe(2);
  });
  it('returns b at t=1', () => {
    expect(lerp(2, 10, 1)).toBe(10);
  });
  it('returns the midpoint at t=0.5', () => {
    expect(lerp(2, 10, 0.5)).toBe(6);
  });
  it('does not clamp â€” extrapolates past b when t>1', () => {
    expect(lerp(0, 10, 1.5)).toBe(15);
  });
  it('does not clamp â€” extrapolates before a when t<0', () => {
    expect(lerp(0, 10, -0.5)).toBe(-5);
  });
  it('handles a descending range (a > b)', () => {
    expect(lerp(10, 0, 0.25)).toBe(7.5);
  });
  it('returns a when a equals b regardless of t', () => {
    expect(lerp(4, 4, 0)).toBe(4);
    expect(lerp(4, 4, 0.5)).toBe(4);
    expect(lerp(4, 4, 1)).toBe(4);
  });
});

describe('AE505 - lerpVec3', () => {
  const A: Vec3Tuple = [0, 0, 0];
  const B: Vec3Tuple = [10, 20, 30];

  it('returns the from-tuple at t=0', () => {
    expect(lerpVec3(A, B, 0)).toEqual([0, 0, 0]);
  });
  it('returns the to-tuple at t=1', () => {
    expect(lerpVec3(A, B, 1)).toEqual([10, 20, 30]);
  });
  it('returns the midpoint per-axis at t=0.5', () => {
    expect(lerpVec3(A, B, 0.5)).toEqual([5, 10, 15]);
  });
  it('returns a fresh array (copy-on-read, not a shared reference)', () => {
    const out1 = lerpVec3(A, B, 0.3);
    const out2 = lerpVec3(A, B, 0.3);
    expect(out1).not.toBe(out2);
    expect(out1).toEqual(out2);
  });
  it('handles negative components correctly', () => {
    expect(lerpVec3([-4, -4, -4], [4, 4, 4], 0.5)).toEqual([0, 0, 0]);
  });
  it('extrapolates per-axis beyond 1', () => {
    expect(lerpVec3([0, 0, 0], [10, 10, 10], 2)).toEqual([20, 20, 20]);
  });
});

describe('AE505 - DEFAULT_CAMERA_SCRIPT', () => {
  it('idle pose is the hero distance (0, 0, 6) looking at the origin', () => {
    expect(DEFAULT_CAMERA_SCRIPT.idle.position).toEqual([0, 0, 6]);
    expect(DEFAULT_CAMERA_SCRIPT.idle.lookAt).toEqual([0, 0, 0]);
  });
  it('materialising pose pulls back to z=9 and lifts +1.5 on Y', () => {
    expect(DEFAULT_CAMERA_SCRIPT.materialising.position).toEqual([0, 1.5, 9]);
    expect(DEFAULT_CAMERA_SCRIPT.materialising.lookAt).toEqual([0, 0, 0]);
  });
  it('settling pose lands back at hero distance', () => {
    expect(DEFAULT_CAMERA_SCRIPT.settling.position).toEqual([0, 0, 6]);
  });
  it('listening pose equals the hero distance (no idle drift in default)', () => {
    expect(DEFAULT_CAMERA_SCRIPT.listening.position).toEqual([0, 0, 6]);
    expect(DEFAULT_CAMERA_SCRIPT.listening.lookAt).toEqual([0, 0, 0]);
  });
  it('dissolving pose pulls back further to z=10 and lifts +1.5 on Y', () => {
    expect(DEFAULT_CAMERA_SCRIPT.dissolving.position).toEqual([0, 1.5, 10]);
    expect(DEFAULT_CAMERA_SCRIPT.dissolving.lookAt).toEqual([0, 0, 0]);
  });
});

describe('AE505 - previousPoseFor (FSM)', () => {
  it('materialising interpolates FROM the idle pose', () => {
    expect(previousPoseFor('materialising', DEFAULT_CAMERA_SCRIPT)).toBe(
      DEFAULT_CAMERA_SCRIPT.idle,
    );
  });
  it('settling interpolates FROM the materialising pose', () => {
    expect(previousPoseFor('settling', DEFAULT_CAMERA_SCRIPT)).toBe(
      DEFAULT_CAMERA_SCRIPT.materialising,
    );
  });
  it('listening interpolates FROM the settling pose', () => {
    expect(previousPoseFor('listening', DEFAULT_CAMERA_SCRIPT)).toBe(
      DEFAULT_CAMERA_SCRIPT.settling,
    );
  });
  it('dissolving interpolates FROM the listening pose', () => {
    expect(previousPoseFor('dissolving', DEFAULT_CAMERA_SCRIPT)).toBe(
      DEFAULT_CAMERA_SCRIPT.listening,
    );
  });
  it('idle stays at idle (no-op self-loop)', () => {
    expect(previousPoseFor('idle', DEFAULT_CAMERA_SCRIPT)).toBe(DEFAULT_CAMERA_SCRIPT.idle);
  });
  it('honours a custom script â€” settling picks up the custom materialising pose', () => {
    const custom: CameraScript = {
      idle: { position: [0, 0, 6], lookAt: [0, 0, 0] },
      materialising: { position: [1, 2, 3], lookAt: [4, 5, 6] },
      settling: { position: [0, 0, 6], lookAt: [0, 0, 0] },
      listening: { position: [0, 0, 6], lookAt: [0, 0, 0] },
      dissolving: { position: [0, 1.5, 10], lookAt: [0, 0, 0] },
    };
    expect(previousPoseFor('settling', custom).position).toEqual([1, 2, 3]);
    expect(previousPoseFor('settling', custom).lookAt).toEqual([4, 5, 6]);
  });
});

describe('AE505 - cameraPoseAt', () => {
  it('at materialising t=0 returns the idle (from) pose exactly', () => {
    const pose = cameraPoseAt('materialising', 0);
    expect(pose.position).toEqual([0, 0, 6]);
    expect(pose.lookAt).toEqual([0, 0, 0]);
  });
  it('at materialising end-of-transient returns the materialising (to) pose', () => {
    const pose = cameraPoseAt('materialising', 999);
    expect(pose.position[0]).toBeCloseTo(0, 10);
    expect(pose.position[1]).toBeCloseTo(1.5, 10);
    expect(pose.position[2]).toBeCloseTo(9, 10);
  });
  it('at settling t=0 returns the materialising (from) pose', () => {
    const pose = cameraPoseAt('settling', 0);
    expect(pose.position).toEqual([0, 1.5, 9]);
  });
  it('at settling end-of-transient returns the settling (hero) pose', () => {
    const pose = cameraPoseAt('settling', 999);
    expect(pose.position[0]).toBeCloseTo(0, 10);
    expect(pose.position[1]).toBeCloseTo(0, 10);
    expect(pose.position[2]).toBeCloseTo(6, 10);
  });
  it('at dissolving t=0 returns the listening (from) pose', () => {
    const pose = cameraPoseAt('dissolving', 0);
    expect(pose.position).toEqual([0, 0, 6]);
  });
  it('at dissolving end-of-transient returns the dissolving (pull-back) pose', () => {
    const pose = cameraPoseAt('dissolving', 999);
    expect(pose.position[0]).toBeCloseTo(0, 10);
    expect(pose.position[1]).toBeCloseTo(1.5, 10);
    expect(pose.position[2]).toBeCloseTo(10, 10);
  });
  it('at idle ambient phase stays at the idle pose (from === to)', () => {
    const pose = cameraPoseAt('idle', 0.3);
    expect(pose.position).toEqual([0, 0, 6]);
    expect(pose.lookAt).toEqual([0, 0, 0]);
  });
  it('at listening ambient phase stays at the hero pose (from === to)', () => {
    const pose = cameraPoseAt('listening', 0.5);
    expect(pose.position).toEqual([0, 0, 6]);
    expect(pose.lookAt).toEqual([0, 0, 0]);
  });
  it('mid-materialising position is between idle and materialising on the Z axis', () => {
    const pose = cameraPoseAt('materialising', 0.35);
    expect(pose.position[2]).toBeGreaterThan(6);
    expect(pose.position[2]).toBeLessThan(9);
  });
  it('mid-materialising position is between idle and materialising on the Y axis', () => {
    const pose = cameraPoseAt('materialising', 0.35);
    expect(pose.position[1]).toBeGreaterThan(0);
    expect(pose.position[1]).toBeLessThan(1.5);
  });
  it('honours a custom script and a custom durations override', () => {
    const customScript: CameraScript = {
      idle: { position: [0, 0, 0], lookAt: [0, 0, 0] },
      materialising: { position: [0, 0, 100], lookAt: [0, 0, 0] },
      settling: { position: [0, 0, 0], lookAt: [0, 0, 0] },
      listening: { position: [0, 0, 0], lookAt: [0, 0, 0] },
      dissolving: { position: [0, 0, 0], lookAt: [0, 0, 0] },
    };
    const pose = cameraPoseAt('materialising', 2, customScript, {
      materialising: 1,
      settling: 1,
      dissolving: 1,
    });
    expect(pose.position[2]).toBeCloseTo(100, 10);
  });
  it('dissolving uses ease-in â€” at mid-elapsed the pose is still close to the from-pose', () => {
    const mid = cameraPoseAt('dissolving', 0.25, DEFAULT_CAMERA_SCRIPT, {
      materialising: 0.7,
      settling: 0.5,
      dissolving: 0.5,
    });
    expect(mid.position[2]).toBeGreaterThan(6);
    expect(mid.position[2]).toBeLessThan(8);
  });
});
