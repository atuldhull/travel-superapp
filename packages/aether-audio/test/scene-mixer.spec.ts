/** AE376 — scene-mixer specs. */
import {
  DRONE_DB,
  EVENTS_DB,
  SILENCE_DB,
  __testing,
  channelGainsAt,
  dbToLinear,
  isChannelSilent,
} from '../src/scene-mixer';

describe('constants', () => {
  it('SILENCE < DRONE < EVENTS', () => {
    expect(SILENCE_DB).toBeLessThan(DRONE_DB);
    expect(DRONE_DB).toBeLessThan(EVENTS_DB);
  });

  it('SILENCE_DB is a sane mute floor', () => {
    expect(SILENCE_DB).toBeLessThanOrEqual(-40);
  });
});

describe('channelGainsAt — idle', () => {
  it('both channels silent', () => {
    expect(channelGainsAt('idle', 0)).toEqual({ drone: SILENCE_DB, events: SILENCE_DB });
    expect(channelGainsAt('idle', 0.5)).toEqual({ drone: SILENCE_DB, events: SILENCE_DB });
  });
});

describe('channelGainsAt — materialising', () => {
  it('drone fades in from silence', () => {
    expect(channelGainsAt('materialising', 0).drone).toBe(SILENCE_DB);
    expect(channelGainsAt('materialising', 1).drone).toBe(DRONE_DB);
    // mid: between SILENCE and DRONE
    const mid = channelGainsAt('materialising', 0.5).drone;
    expect(mid).toBeGreaterThan(SILENCE_DB);
    expect(mid).toBeLessThan(DRONE_DB);
  });

  it('events stays silent throughout', () => {
    expect(channelGainsAt('materialising', 0).events).toBe(SILENCE_DB);
    expect(channelGainsAt('materialising', 1).events).toBe(SILENCE_DB);
  });
});

describe('channelGainsAt — settling', () => {
  it('drone holds at level', () => {
    expect(channelGainsAt('settling', 0).drone).toBe(DRONE_DB);
    expect(channelGainsAt('settling', 1).drone).toBe(DRONE_DB);
  });

  it('events fades up from silence to active', () => {
    expect(channelGainsAt('settling', 0).events).toBe(SILENCE_DB);
    expect(channelGainsAt('settling', 1).events).toBe(EVENTS_DB);
  });
});

describe('channelGainsAt — listening', () => {
  it('both channels at reference levels', () => {
    expect(channelGainsAt('listening', 0)).toEqual({ drone: DRONE_DB, events: EVENTS_DB });
    expect(channelGainsAt('listening', 1)).toEqual({ drone: DRONE_DB, events: EVENTS_DB });
  });
});

describe('channelGainsAt — dissolving', () => {
  it('drone fades out', () => {
    expect(channelGainsAt('dissolving', 0).drone).toBe(DRONE_DB);
    expect(channelGainsAt('dissolving', 1).drone).toBe(SILENCE_DB);
  });

  it('events stays silent', () => {
    expect(channelGainsAt('dissolving', 0).events).toBe(SILENCE_DB);
    expect(channelGainsAt('dissolving', 1).events).toBe(SILENCE_DB);
  });
});

describe('channelGainsAt — progress clamping', () => {
  it('progress >1 clamps to 1', () => {
    expect(channelGainsAt('materialising', 2).drone).toBe(DRONE_DB);
  });

  it('progress <0 clamps to 0', () => {
    expect(channelGainsAt('materialising', -1).drone).toBe(SILENCE_DB);
  });
});

describe('isChannelSilent', () => {
  it('true when both channels are at silence floor', () => {
    expect(isChannelSilent({ drone: SILENCE_DB, events: SILENCE_DB })).toBe(true);
  });

  it('false when drone is audible', () => {
    expect(isChannelSilent({ drone: DRONE_DB, events: SILENCE_DB })).toBe(false);
  });

  it('false when events is audible', () => {
    expect(isChannelSilent({ drone: SILENCE_DB, events: EVENTS_DB })).toBe(false);
  });

  it('treats anything <= floor as silent', () => {
    expect(isChannelSilent({ drone: -90, events: -90 })).toBe(true);
  });
});

describe('dbToLinear', () => {
  it('0 dB → 1.0 linear', () => {
    expect(dbToLinear(0)).toBeCloseTo(1.0, 6);
  });

  it('-6 dB → ~0.501 linear', () => {
    expect(dbToLinear(-6)).toBeCloseTo(0.5012, 3);
  });

  it('-20 dB → 0.1 linear', () => {
    expect(dbToLinear(-20)).toBeCloseTo(0.1, 6);
  });

  it('mute floor → 0', () => {
    expect(dbToLinear(SILENCE_DB)).toBe(0);
    expect(dbToLinear(-90)).toBe(0);
  });
});

describe('internal helpers', () => {
  const { lerp, clamp01 } = __testing;

  it('lerp', () => {
    expect(lerp(0, 10, 0)).toBe(0);
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(lerp(0, 10, 1)).toBe(10);
  });

  it('clamp01', () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(0)).toBe(0);
    expect(clamp01(0.5)).toBe(0.5);
    expect(clamp01(1)).toBe(1);
    expect(clamp01(2)).toBe(1);
  });
});
