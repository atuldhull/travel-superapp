/** AE375 — lifecycle-camera pure-math specs. */
import {
  DEFAULT_CAMERA_SCRIPT,
  cameraPoseAt,
  lerp,
  lerpVec3,
  previousPoseFor,
} from '../src/lifecycle-camera';
import { DEFAULT_PHASE_DURATIONS } from '../src/lifecycle-progress';

describe('lerp', () => {
  it('boundary cases', () => {
    expect(lerp(0, 10, 0)).toBe(0);
    expect(lerp(0, 10, 1)).toBe(10);
    expect(lerp(5, 15, 0.5)).toBe(10);
  });

  it('extrapolates past boundaries without clamping', () => {
    expect(lerp(0, 10, 2)).toBe(20);
    expect(lerp(0, 10, -1)).toBe(-10);
  });
});

describe('lerpVec3', () => {
  it('component-wise', () => {
    expect(lerpVec3([0, 0, 0], [10, 20, 30], 0.5)).toEqual([5, 10, 15]);
  });

  it('endpoints', () => {
    expect(lerpVec3([1, 2, 3], [4, 5, 6], 0)).toEqual([1, 2, 3]);
    expect(lerpVec3([1, 2, 3], [4, 5, 6], 1)).toEqual([4, 5, 6]);
  });
});

describe('previousPoseFor', () => {
  it('materialising follows idle', () => {
    expect(previousPoseFor('materialising', DEFAULT_CAMERA_SCRIPT)).toEqual(
      DEFAULT_CAMERA_SCRIPT.idle,
    );
  });

  it('settling follows materialising', () => {
    expect(previousPoseFor('settling', DEFAULT_CAMERA_SCRIPT)).toEqual(
      DEFAULT_CAMERA_SCRIPT.materialising,
    );
  });

  it('listening follows settling', () => {
    expect(previousPoseFor('listening', DEFAULT_CAMERA_SCRIPT)).toEqual(
      DEFAULT_CAMERA_SCRIPT.settling,
    );
  });

  it('dissolving follows listening', () => {
    expect(previousPoseFor('dissolving', DEFAULT_CAMERA_SCRIPT)).toEqual(
      DEFAULT_CAMERA_SCRIPT.listening,
    );
  });

  it('idle holds its own pose', () => {
    expect(previousPoseFor('idle', DEFAULT_CAMERA_SCRIPT)).toEqual(DEFAULT_CAMERA_SCRIPT.idle);
  });
});

describe('cameraPoseAt — materialising', () => {
  it('starts at idle pose (t=0)', () => {
    const pose = cameraPoseAt('materialising', 0);
    expect(pose.position).toEqual(DEFAULT_CAMERA_SCRIPT.idle.position);
  });

  it('ends at materialising pose (t=duration)', () => {
    const d = DEFAULT_PHASE_DURATIONS.materialising;
    const pose = cameraPoseAt('materialising', d);
    expect(pose.position).toEqual(DEFAULT_CAMERA_SCRIPT.materialising.position);
  });

  it('mid-progress is past the linear midpoint (ease-out)', () => {
    const d = DEFAULT_PHASE_DURATIONS.materialising;
    const pose = cameraPoseAt('materialising', d / 2);
    // Position interpolates from idle (z=6) → materialising (z=9), so the
    // eased midpoint should be > linear midpoint (7.5).
    expect(pose.position[2]).toBeGreaterThan(7.5);
  });
});

describe('cameraPoseAt — settling', () => {
  it('ends at the settling pose = hero pose (Drift default)', () => {
    const d = DEFAULT_PHASE_DURATIONS.settling;
    const pose = cameraPoseAt('settling', d);
    expect(pose.position).toEqual(DEFAULT_CAMERA_SCRIPT.settling.position);
    expect(pose.lookAt).toEqual([0, 0, 0]);
  });
});

describe('cameraPoseAt — dissolving', () => {
  it('starts at listening pose', () => {
    const pose = cameraPoseAt('dissolving', 0);
    expect(pose.position).toEqual(DEFAULT_CAMERA_SCRIPT.listening.position);
  });

  it('ends at dissolving pose', () => {
    const d = DEFAULT_PHASE_DURATIONS.dissolving;
    const pose = cameraPoseAt('dissolving', d);
    expect(pose.position).toEqual(DEFAULT_CAMERA_SCRIPT.dissolving.position);
  });

  it('mid-progress is before the linear midpoint (ease-in)', () => {
    const d = DEFAULT_PHASE_DURATIONS.dissolving;
    const pose = cameraPoseAt('dissolving', d / 2);
    // Position interpolates from listening (z=6) → dissolving (z=10), so the
    // eased midpoint should be < linear midpoint (8).
    expect(pose.position[2]).toBeLessThan(8);
  });
});

describe('cameraPoseAt — idle + listening', () => {
  it('idle holds the idle pose', () => {
    const pose = cameraPoseAt('idle', 0.5);
    expect(pose.position).toEqual(DEFAULT_CAMERA_SCRIPT.idle.position);
  });

  it('listening holds the listening pose', () => {
    const pose = cameraPoseAt('listening', 0.5);
    expect(pose.position).toEqual(DEFAULT_CAMERA_SCRIPT.listening.position);
  });
});

describe('cameraPoseAt — custom script', () => {
  it('honours an override script', () => {
    const custom = {
      ...DEFAULT_CAMERA_SCRIPT,
      settling: { position: [10, 20, 30], lookAt: [1, 1, 1] } as const,
    };
    const d = DEFAULT_PHASE_DURATIONS.settling;
    const pose = cameraPoseAt('settling', d, custom);
    expect(pose.position).toEqual([10, 20, 30]);
    expect(pose.lookAt).toEqual([1, 1, 1]);
  });
});
