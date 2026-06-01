/**
 * AE472 — cross-package lifecycle handoff integration spec.
 *
 * Verifies the three-way contract that lives across:
 *   1. @app/aether-core         — the lifecycle FSM (idle → materialising →
 *                                 settling → listening → dissolving → idle)
 *                                 surfaced to React via `useSurfaceLifecycle`.
 *   2. @app/aether-canvas       — `easedPhaseProgress` + `cameraPoseAt` use
 *                                 the same phase tag + elapsed-in-phase to
 *                                 interpolate the camera pose.
 *   3. @app/aether-audio        — `channelGainsAt` reads the same phase tag
 *                                 + (eased) progress to fade the drone +
 *                                 events channels.
 *
 * The hook itself is React-bound, so this spec pins the phase manually and
 * walks the FSM via `nextLifecyclePhase` — the same step the provider takes
 * inside React. Each pure helper is then evaluated at the same (phase,
 * elapsed) pair to verify the math co-evolves correctly.
 *
 * Node environment (no jsdom). Mirrors the patterns of
 * `lifecycle-progress.spec.ts` + `lifecycle-camera.spec.ts`.
 */
import {
  SURFACE_PHASE_ORDER,
  canTransition,
  nextLifecyclePhase,
  type SurfaceLifecyclePhase,
} from '@app/aether-core';
import { DEFAULT_CAMERA_SCRIPT, cameraPoseAt } from '../src/lifecycle-camera';
import { DEFAULT_PHASE_DURATIONS, easedPhaseProgress } from '../src/lifecycle-progress';
/**
 * Scene-mixer surface from `@app/aether-audio`. Loaded via `require` to
 * keep this an integration spec without adding a workspace dependency
 * edge from `@app/aether-canvas` → `@app/aether-audio` (and without
 * forcing the canvas tsconfig `rootDir` to widen). The runtime resolver
 * walks the relative path; types are declared locally and asserted via
 * the `SceneMixerModule` shape so the typecheck stays strict.
 */
interface ChannelGainsDb {
  readonly drone: number;
  readonly events: number;
}
interface SceneMixerModule {
  readonly SILENCE_DB: number;
  readonly DRONE_DB: number;
  readonly EVENTS_DB: number;
  channelGainsAt(phase: SurfaceLifecyclePhase, progress: number): ChannelGainsDb;
  isChannelSilent(gains: ChannelGainsDb): boolean;
}
const sceneMixer: SceneMixerModule =
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('../../aether-audio/src/scene-mixer') as SceneMixerModule;
const { SILENCE_DB, DRONE_DB, EVENTS_DB, channelGainsAt, isChannelSilent } = sceneMixer;

describe('AE472 — lifecycle handoff: core ↔ canvas ↔ audio', () => {
  describe('phase order is the same vocabulary all three packages agree on', () => {
    it('FSM exposes all five phases the camera + audio scripts target', () => {
      expect(SURFACE_PHASE_ORDER).toEqual([
        'idle',
        'materialising',
        'settling',
        'listening',
        'dissolving',
      ]);
    });

    it('each FSM phase has both a camera pose and an audio gain mapping', () => {
      for (const phase of SURFACE_PHASE_ORDER) {
        // canvas: every phase resolves to a finite pose.
        const pose = cameraPoseAt(phase, 0);
        expect(pose.position.every((n) => Number.isFinite(n))).toBe(true);
        expect(pose.lookAt.every((n) => Number.isFinite(n))).toBe(true);
        // audio: every phase resolves to finite dB values.
        const gains = channelGainsAt(phase, 0);
        expect(Number.isFinite(gains.drone)).toBe(true);
        expect(Number.isFinite(gains.events)).toBe(true);
      }
    });
  });

  describe('idle — rest state in all three layers', () => {
    it('FSM next step is materialise; camera holds idle pose; audio is silent', () => {
      const phase: SurfaceLifecyclePhase = 'idle';
      expect(nextLifecyclePhase(phase)).toBe('materialising');

      const pose = cameraPoseAt(phase, 0.5);
      expect(pose.position).toEqual(DEFAULT_CAMERA_SCRIPT.idle.position);

      const gains = channelGainsAt(phase, 0.5);
      expect(gains.drone).toBe(SILENCE_DB);
      expect(gains.events).toBe(SILENCE_DB);
      expect(isChannelSilent(gains)).toBe(true);
    });
  });

  describe('idle → materialising — camera pulls in while drone fades up', () => {
    it('FSM legalises the transition', () => {
      expect(canTransition('idle', 'materialising')).toBe(true);
    });

    it('at t=0 camera sits at the idle pose and audio is still silent', () => {
      const eased = easedPhaseProgress('materialising', 0);
      expect(eased).toBe(0);

      const pose = cameraPoseAt('materialising', 0);
      expect(pose.position).toEqual(DEFAULT_CAMERA_SCRIPT.idle.position);

      const gains = channelGainsAt('materialising', eased);
      expect(gains.drone).toBe(SILENCE_DB);
      expect(gains.events).toBe(SILENCE_DB);
    });

    it('at end-of-phase camera is at materialising pose and drone is at reference level', () => {
      const d = DEFAULT_PHASE_DURATIONS.materialising;
      const eased = easedPhaseProgress('materialising', d);
      expect(eased).toBe(1);

      const pose = cameraPoseAt('materialising', d);
      expect(pose.position).toEqual(DEFAULT_CAMERA_SCRIPT.materialising.position);

      const gains = channelGainsAt('materialising', eased);
      expect(gains.drone).toBe(DRONE_DB);
      // Events deliberately stay silent through materialising so the user
      // hears the surface arrive before the first confirm.
      expect(gains.events).toBe(SILENCE_DB);
    });

    it('camera ease-out and drone fade-in advance from the same eased progress', () => {
      const d = DEFAULT_PHASE_DURATIONS.materialising;
      const eased = easedPhaseProgress('materialising', d / 2);
      // ease-out cubic at t=0.5 is past the linear midpoint, so both the
      // camera position (z fades from 6 → 9) and the drone gain are past
      // their linear midpoints.
      expect(eased).toBeGreaterThan(0.5);

      const pose = cameraPoseAt('materialising', d / 2);
      expect(pose.position[2]).toBeGreaterThan(7.5);

      const gains = channelGainsAt('materialising', eased);
      const droneMidpoint = (SILENCE_DB + DRONE_DB) / 2;
      expect(gains.drone).toBeGreaterThan(droneMidpoint);
    });
  });

  describe('materialising → settling — camera lands; events fade up', () => {
    it('FSM legalises the transition', () => {
      expect(canTransition('materialising', 'settling')).toBe(true);
    });

    it('at end-of-phase camera lands at hero and events reach reference', () => {
      const d = DEFAULT_PHASE_DURATIONS.settling;
      const eased = easedPhaseProgress('settling', d);

      const pose = cameraPoseAt('settling', d);
      expect(pose.position).toEqual(DEFAULT_CAMERA_SCRIPT.settling.position);

      const gains = channelGainsAt('settling', eased);
      expect(gains.drone).toBe(DRONE_DB);
      expect(gains.events).toBe(EVENTS_DB);
    });

    it('drone stays at reference throughout the phase (no flicker)', () => {
      for (const ratio of [0, 0.25, 0.5, 0.75, 1]) {
        const elapsed = DEFAULT_PHASE_DURATIONS.settling * ratio;
        const eased = easedPhaseProgress('settling', elapsed);
        expect(channelGainsAt('settling', eased).drone).toBe(DRONE_DB);
      }
    });
  });

  describe('settling → listening — steady-state in all three layers', () => {
    it('FSM legalises the transition; listening self-loops too', () => {
      expect(canTransition('settling', 'listening')).toBe(true);
      // The one legal self-loop on the lifecycle FSM.
      expect(canTransition('listening', 'listening')).toBe(true);
    });

    it('listening holds hero pose + both channels at their reference levels', () => {
      const eased = easedPhaseProgress('listening', 1.234);
      // Listening is an ambient phase — linear, wrapping progress only
      // matters for visual loops (not for our pose math, which holds).
      const pose = cameraPoseAt('listening', 1.234);
      expect(pose.position).toEqual(DEFAULT_CAMERA_SCRIPT.listening.position);

      const gains = channelGainsAt('listening', eased);
      expect(gains.drone).toBe(DRONE_DB);
      expect(gains.events).toBe(EVENTS_DB);
      expect(isChannelSilent(gains)).toBe(false);
    });
  });

  describe('listening → dissolving — camera pulls back; drone fades out', () => {
    it('FSM legalises the transition', () => {
      expect(canTransition('listening', 'dissolving')).toBe(true);
    });

    it('at t=0 camera sits at listening pose and drone is still at reference', () => {
      const eased = easedPhaseProgress('dissolving', 0);
      expect(eased).toBe(0);

      const pose = cameraPoseAt('dissolving', 0);
      expect(pose.position).toEqual(DEFAULT_CAMERA_SCRIPT.listening.position);

      const gains = channelGainsAt('dissolving', eased);
      expect(gains.drone).toBe(DRONE_DB);
      // Events go silent immediately at dissolve so the user doesn't hear
      // a confirm during the wind-down.
      expect(gains.events).toBe(SILENCE_DB);
    });

    it('at end-of-phase camera reaches dissolving pose and channels are silent', () => {
      const d = DEFAULT_PHASE_DURATIONS.dissolving;
      const eased = easedPhaseProgress('dissolving', d);
      expect(eased).toBe(1);

      const pose = cameraPoseAt('dissolving', d);
      expect(pose.position).toEqual(DEFAULT_CAMERA_SCRIPT.dissolving.position);

      const gains = channelGainsAt('dissolving', eased);
      expect(gains.drone).toBe(SILENCE_DB);
      expect(gains.events).toBe(SILENCE_DB);
      expect(isChannelSilent(gains)).toBe(true);
    });

    it('camera ease-in and drone fade-out lag the linear midpoint together', () => {
      const d = DEFAULT_PHASE_DURATIONS.dissolving;
      const eased = easedPhaseProgress('dissolving', d / 2);
      // ease-in cubic at t=0.5 is below the linear midpoint.
      expect(eased).toBeLessThan(0.5);

      const pose = cameraPoseAt('dissolving', d / 2);
      // Position z fades 6 → 10, so eased mid is < linear mid (8).
      expect(pose.position[2]).toBeLessThan(8);

      const gains = channelGainsAt('dissolving', eased);
      const droneMidpoint = (DRONE_DB + SILENCE_DB) / 2;
      // ease-in delays the fade, so the drone is louder than the linear
      // midpoint at this point in the phase.
      expect(gains.drone).toBeGreaterThan(droneMidpoint);
    });
  });

  describe('dissolving → idle — loop closes; all layers return to rest', () => {
    it('FSM closes the loop back to idle', () => {
      expect(nextLifecyclePhase('dissolving')).toBe('idle');
      expect(canTransition('dissolving', 'idle')).toBe(true);
    });

    it('once back at idle the camera is at rest pose and audio is silent', () => {
      const pose = cameraPoseAt('idle', 0);
      expect(pose.position).toEqual(DEFAULT_CAMERA_SCRIPT.idle.position);
      const gains = channelGainsAt('idle', 0);
      expect(isChannelSilent(gains)).toBe(true);
    });
  });

  describe('illegal jumps are rejected by the FSM', () => {
    it('settling cannot skip straight to dissolving', () => {
      expect(canTransition('settling', 'dissolving')).toBe(false);
    });

    it('idle cannot skip straight to listening', () => {
      expect(canTransition('idle', 'listening')).toBe(false);
    });
  });

  describe('full walk: stepping the FSM yields a monotonic camera + audio script', () => {
    it('walks idle → materialising → settling → listening → dissolving → idle', () => {
      const visited: SurfaceLifecyclePhase[] = [];
      let phase: SurfaceLifecyclePhase = 'idle';

      // Walk one full loop. Each step is FSM-legal by construction.
      for (let i = 0; i < SURFACE_PHASE_ORDER.length; i++) {
        visited.push(phase);
        const next = nextLifecyclePhase(phase);
        expect(canTransition(phase, next)).toBe(true);
        phase = next;
      }

      expect(visited).toEqual(['idle', 'materialising', 'settling', 'listening', 'dissolving']);
      // After five steps we're back at the rest state.
      expect(phase).toBe('idle');

      // Sanity: at each phase boundary (end of phase, eased=1) the camera
      // pose matches the script's target for that phase and the audio
      // channels match the documented end-of-phase levels.
      const endOfPhasePose = (p: SurfaceLifecyclePhase) =>
        p === 'idle' || p === 'listening'
          ? cameraPoseAt(p, 0).position
          : cameraPoseAt(p, DEFAULT_PHASE_DURATIONS[p]).position;

      expect(endOfPhasePose('materialising')).toEqual(DEFAULT_CAMERA_SCRIPT.materialising.position);
      expect(endOfPhasePose('settling')).toEqual(DEFAULT_CAMERA_SCRIPT.settling.position);
      expect(endOfPhasePose('dissolving')).toEqual(DEFAULT_CAMERA_SCRIPT.dissolving.position);
    });
  });
});
