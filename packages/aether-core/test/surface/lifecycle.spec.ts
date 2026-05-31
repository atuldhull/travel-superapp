/** AE374 — lifecycle FSM specs. */
import {
  SURFACE_PHASE_ORDER,
  canTransition,
  isTerminalPhase,
  nextLifecyclePhase,
} from '../../src/surface/lifecycle';

describe('SURFACE_PHASE_ORDER', () => {
  it('is the canonical five-phase order', () => {
    expect(SURFACE_PHASE_ORDER).toEqual([
      'idle',
      'materialising',
      'settling',
      'listening',
      'dissolving',
    ]);
  });
});

describe('nextLifecyclePhase', () => {
  it('steps forward through the loop', () => {
    expect(nextLifecyclePhase('idle')).toBe('materialising');
    expect(nextLifecyclePhase('materialising')).toBe('settling');
    expect(nextLifecyclePhase('settling')).toBe('listening');
    expect(nextLifecyclePhase('listening')).toBe('dissolving');
  });

  it('closes the loop: dissolving → idle', () => {
    expect(nextLifecyclePhase('dissolving')).toBe('idle');
  });
});

describe('isTerminalPhase', () => {
  it('only idle is terminal', () => {
    expect(isTerminalPhase('idle')).toBe(true);
    expect(isTerminalPhase('materialising')).toBe(false);
    expect(isTerminalPhase('settling')).toBe(false);
    expect(isTerminalPhase('listening')).toBe(false);
    expect(isTerminalPhase('dissolving')).toBe(false);
  });
});

describe('canTransition', () => {
  it('forward steps are allowed', () => {
    expect(canTransition('idle', 'materialising')).toBe(true);
    expect(canTransition('materialising', 'settling')).toBe(true);
    expect(canTransition('settling', 'listening')).toBe(true);
    expect(canTransition('listening', 'dissolving')).toBe(true);
    expect(canTransition('dissolving', 'idle')).toBe(true);
  });

  it('skip-ahead is not allowed', () => {
    expect(canTransition('idle', 'settling')).toBe(false);
    expect(canTransition('materialising', 'listening')).toBe(false);
    expect(canTransition('settling', 'dissolving')).toBe(false);
  });

  it('backward steps are not allowed', () => {
    expect(canTransition('listening', 'settling')).toBe(false);
    expect(canTransition('dissolving', 'listening')).toBe(false);
    expect(canTransition('materialising', 'idle')).toBe(false);
  });

  it('listening self-loops are allowed (user-interaction tick)', () => {
    expect(canTransition('listening', 'listening')).toBe(true);
  });

  it('no other self-loop is allowed', () => {
    expect(canTransition('idle', 'idle')).toBe(false);
    expect(canTransition('materialising', 'materialising')).toBe(false);
    expect(canTransition('settling', 'settling')).toBe(false);
    expect(canTransition('dissolving', 'dissolving')).toBe(false);
  });
});
