/** AE380 — scene-audio-bridge pure transition specs. */
import {
  INITIAL_CHANNEL_SNAPSHOT,
  computeEdgeTransitions,
  hasAnyAction,
  type ChannelSnapshot,
} from '../src/scene-audio-bridge';
import { DRONE_DB, EVENTS_DB, SILENCE_DB } from '../src/scene-mixer';

const silent: ChannelSnapshot = INITIAL_CHANNEL_SNAPSHOT;
const droneOnly: ChannelSnapshot = { drone: DRONE_DB, events: SILENCE_DB };
const droneAndEvents: ChannelSnapshot = { drone: DRONE_DB, events: EVENTS_DB };

describe('INITIAL_CHANNEL_SNAPSHOT', () => {
  it('starts at silence on both channels', () => {
    expect(INITIAL_CHANNEL_SNAPSHOT.drone).toBe(SILENCE_DB);
    expect(INITIAL_CHANNEL_SNAPSHOT.events).toBe(SILENCE_DB);
  });
});

describe('computeEdgeTransitions — drone rising edge', () => {
  it('silent → drone audible → startAmbient: true', () => {
    const a = computeEdgeTransitions(silent, droneOnly);
    expect(a.startAmbient).toBe(true);
    expect(a.stopAmbient).toBe(false);
  });

  it('starts master tracking the new drone level', () => {
    const a = computeEdgeTransitions(silent, droneOnly);
    expect(a.setMasterDb).toBe(DRONE_DB);
  });
});

describe('computeEdgeTransitions — drone falling edge', () => {
  it('audible → silent → stopAmbient: true', () => {
    const a = computeEdgeTransitions(droneOnly, silent);
    expect(a.startAmbient).toBe(false);
    expect(a.stopAmbient).toBe(true);
  });

  it('does not push a master-dB change when going silent', () => {
    const a = computeEdgeTransitions(droneOnly, silent);
    expect(a.setMasterDb).toBeNull();
  });
});

describe('computeEdgeTransitions — drone steady', () => {
  it('staying silent → no actions', () => {
    const a = computeEdgeTransitions(silent, silent);
    expect(a.startAmbient).toBe(false);
    expect(a.stopAmbient).toBe(false);
    expect(a.tick).toBe(false);
    expect(a.setMasterDb).toBeNull();
  });

  it('staying audible at the same level → no start/stop, master tracks anyway', () => {
    const a = computeEdgeTransitions(droneOnly, droneOnly);
    expect(a.startAmbient).toBe(false);
    expect(a.stopAmbient).toBe(false);
    expect(a.setMasterDb).toBe(DRONE_DB);
  });

  it('staying audible at a new level → master updates', () => {
    const louder: ChannelSnapshot = { drone: -3, events: SILENCE_DB };
    const a = computeEdgeTransitions(droneOnly, louder);
    expect(a.setMasterDb).toBe(-3);
  });
});

describe('computeEdgeTransitions — events rising edge', () => {
  it('events going from silent → audible → tick: true', () => {
    const a = computeEdgeTransitions(droneOnly, droneAndEvents);
    expect(a.tick).toBe(true);
  });

  it('events steady (no transition) → tick: false', () => {
    const a = computeEdgeTransitions(droneAndEvents, droneAndEvents);
    expect(a.tick).toBe(false);
  });

  it('events going silent → no tick fires (no falling-edge tick)', () => {
    const a = computeEdgeTransitions(droneAndEvents, droneOnly);
    expect(a.tick).toBe(false);
  });
});

describe('computeEdgeTransitions — composite phase transitions', () => {
  it('idle → materialising: drone rising, no events tick', () => {
    const materialising: ChannelSnapshot = { drone: -30, events: SILENCE_DB };
    const a = computeEdgeTransitions(silent, materialising);
    expect(a.startAmbient).toBe(true);
    expect(a.tick).toBe(false);
    expect(a.setMasterDb).toBe(-30);
  });

  it('settling → listening: events crosses into audible → tick', () => {
    const settlingMid: ChannelSnapshot = { drone: DRONE_DB, events: -30 };
    const listening: ChannelSnapshot = { drone: DRONE_DB, events: EVENTS_DB };
    const a = computeEdgeTransitions(settlingMid, listening);
    expect(a.tick).toBe(false); // both were audible; events just changed level
    expect(a.startAmbient).toBe(false);
    expect(a.stopAmbient).toBe(false);
  });

  it('listening → dissolving: drone fades down; no actions until silent', () => {
    const dissolveMid: ChannelSnapshot = { drone: -30, events: SILENCE_DB };
    const a = computeEdgeTransitions(droneAndEvents, dissolveMid);
    expect(a.stopAmbient).toBe(false);
    expect(a.setMasterDb).toBe(-30);
  });

  it('dissolving complete: drone reaches silence → stopAmbient', () => {
    const dissolveMid: ChannelSnapshot = { drone: -30, events: SILENCE_DB };
    const a = computeEdgeTransitions(dissolveMid, silent);
    expect(a.stopAmbient).toBe(true);
    expect(a.setMasterDb).toBeNull();
  });
});

describe('hasAnyAction', () => {
  it('true when startAmbient is set', () => {
    expect(hasAnyAction(computeEdgeTransitions(silent, droneOnly))).toBe(true);
  });

  it('true when stopAmbient is set', () => {
    expect(hasAnyAction(computeEdgeTransitions(droneOnly, silent))).toBe(true);
  });

  it('true when tick is set', () => {
    expect(hasAnyAction(computeEdgeTransitions(droneOnly, droneAndEvents))).toBe(true);
  });

  it('true when setMasterDb is non-null', () => {
    expect(hasAnyAction(computeEdgeTransitions(droneOnly, droneOnly))).toBe(true);
  });

  it('false when all four are no-op (staying silent)', () => {
    expect(hasAnyAction(computeEdgeTransitions(silent, silent))).toBe(false);
  });
});
