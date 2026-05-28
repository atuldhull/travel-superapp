/**
 * @app/aether-motion / audio — key signatures, sample manifests, envelope tokens.
 *
 * Audio policy locked: mandatory but respects OS mute + reduced-motion
 * + explicit user opt-out (see docs/aether/06-decisions.md #4).
 *
 * This file ships VALUES only — pitches, envelope shapes, sample URLs.
 * The actual Tone.js / WebAudio engine lives in `@app/aether-core` so
 * non-runtime consumers (Storybook, ADR diffs, type tests) can import
 * tokens without pulling in a 200kb audio library.
 *
 * Brand audio palette: nylon-string + analog tape warmth + soft mandolin
 * confirms. Per-region key signatures arrive Phase 6 — for now every
 * surface uses the default Italian-key (D minor pentatonic with a
 * sustained C drone).
 */

/** A musical note in standard pitch notation. */
export type Pitch =
  | 'C2'
  | 'D2'
  | 'E2'
  | 'F2'
  | 'G2'
  | 'A2'
  | 'B2'
  | 'C3'
  | 'D3'
  | 'E3'
  | 'F3'
  | 'G3'
  | 'A3'
  | 'B3'
  | 'C4'
  | 'D4'
  | 'E4'
  | 'F4'
  | 'G4'
  | 'A4'
  | 'B4'
  | 'C5'
  | 'D5'
  | 'E5'
  | 'F5'
  | 'G5'
  | 'A5'
  | 'B5';

/** Key signature — the set of pitches a surface draws from for confirms,
 *  ambient pads, transitions. Locked at the surface level so all sounds
 *  on Drift harmonize with each other. */
export interface KeySignature {
  /** Tonic — pitch the drone sits on. */
  readonly tonic: Pitch;
  /** Scale — pitches available for melodic events. */
  readonly scale: readonly Pitch[];
  /** Tempo (BPM) — ambient pads + transitions sync to this. */
  readonly tempo: number;
}

/** The default Aether key — D minor pentatonic, 64bpm.
 *  Choice rationale: minor pentatonic avoids dissonance no matter which
 *  notes overlap; 64bpm is slow enough to feel meditative but fast
 *  enough that confirms don't drag. */
export const italianKey: KeySignature = {
  tonic: 'D3',
  scale: ['D3', 'F3', 'G3', 'A3', 'C4', 'D4', 'F4', 'G4', 'A4'],
  tempo: 64,
};

/** Surface-level key signatures. Drift uses the Italian default; other
 *  surfaces may transpose in Phase 1-2 to feel slightly different. */
export const surfaceKeys = {
  drift: italianKey,
  atlas: italianKey,
  pulse: italianKey,
  compass: italianKey,
  // lumen / genie / echo / vault / mirror / continuum arrive later phases
} as const;

/** Envelope shape — ADSR-ish but in unit time (0..1) so it scales with
 *  duration. Consumed by Tone.js AmplitudeEnvelope. */
export interface Envelope {
  readonly attack: number;
  readonly decay: number;
  readonly sustain: number;
  readonly release: number;
}

/** Pluck — nylon-string-like, short attack + long release. The
 *  signature confirm sound. */
export const pluck: Envelope = {
  attack: 0.02,
  decay: 0.12,
  sustain: 0.3,
  release: 1.2,
};

/** Pad — ambient drone background; slow attack, infinite sustain. */
export const pad: Envelope = {
  attack: 1.5,
  decay: 0.8,
  sustain: 0.7,
  release: 4.0,
};

/** Tick — micro-interaction (hover, focus). Almost-no envelope. */
export const tick: Envelope = {
  attack: 0.001,
  decay: 0.04,
  sustain: 0,
  release: 0.08,
};

/** Sweep — surface transition; long attack, no sustain, long release. */
export const sweep: Envelope = {
  attack: 0.6,
  decay: 0.0,
  sustain: 1.0,
  release: 1.8,
};

export const envelopes = { pluck, pad, tick, sweep } as const;
export type EnvelopeName = keyof typeof envelopes;

/** Sample-manifest entry — points the audio engine at an MP3/OGG/WAV
 *  file. URLs are CDN-relative; the engine prepends the deployment
 *  origin. Per-destination samples land in Phase 6. */
export interface SampleEntry {
  readonly url: string;
  /** Loop the sample (drones, pads). */
  readonly loop: boolean;
  /** Default gain in dB; engine applies user-volume on top. */
  readonly gainDb: number;
}

/** Phase 0 sample set — three placeholder URLs.
 *  All replaced in Phase 2 with composer-delivered assets. */
export const samples = {
  /** Nylon-string root pluck for confirm events. */
  nylonPluck: {
    url: '/audio/aether/v0/nylon-pluck-d3.mp3',
    loop: false,
    gainDb: -6,
  },
  /** Analog-tape ambient pad — Drift / Atlas surface background. */
  tapeAmbient: {
    url: '/audio/aether/v0/tape-ambient-d-min.mp3',
    loop: true,
    gainDb: -18,
  },
  /** Mandolin confirm — used on premium-gate unlock + memory-book completion. */
  mandolinConfirm: {
    url: '/audio/aether/v0/mandolin-flourish-d-min.mp3',
    loop: false,
    gainDb: -9,
  },
} as const;

export type SampleName = keyof typeof samples;
