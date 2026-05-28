#!/usr/bin/env node
/**
 * Phase 0 placeholder audio sample generator.
 *
 * Synthesizes three small 16-bit PCM WAV files into
 * apps/web/public/audio/aether/v0/ so the Drift prototype makes sound
 * without waiting for the composer engagement (which arrives Phase 2
 * per docs/aether/06-decisions.md).
 *
 * Files:
 *   1. nylon-pluck-d3.wav    — single plucked note, D3 = 146.83 Hz, ~1.6s
 *   2. tape-ambient-d-min.wav — looping ambient pad, D minor pentatonic, ~6s
 *   3. mandolin-flourish-d-min.wav — fast arpeggio, D-F-A-D pentatonic, ~2s
 *
 * Synthesis is intentionally lo-fi (additive sines + pluck/pad envelopes,
 * mild tape-style detuning). Replaced by real recorded samples in Phase 2.
 *
 * Run: node scripts/aether/gen-samples.mjs
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const HERE = dirname(__filename);
const OUT_DIR = resolve(HERE, '../../apps/web/public/audio/aether/v0');
mkdirSync(OUT_DIR, { recursive: true });

// ---------- WAV writer ----------

const SAMPLE_RATE = 44100;

/** Build a 16-bit PCM mono WAV from a Float32Array in [-1, 1]. */
function writeWav(samples, outPath) {
  const numSamples = samples.length;
  const byteLength = 44 + numSamples * 2;
  const buf = Buffer.alloc(byteLength);
  // RIFF header
  buf.write('RIFF', 0);
  buf.writeUInt32LE(byteLength - 8, 4);
  buf.write('WAVE', 8);
  // fmt chunk
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); // chunk size
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(SAMPLE_RATE, 24);
  buf.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte rate
  buf.writeUInt16LE(2, 32); // block align
  buf.writeUInt16LE(16, 34); // bits per sample
  // data chunk
  buf.write('data', 36);
  buf.writeUInt32LE(numSamples * 2, 40);
  for (let i = 0; i < numSamples; i += 1) {
    const clipped = Math.max(-1, Math.min(1, samples[i]));
    const v = Math.round(clipped * 32767);
    buf.writeInt16LE(v, 44 + i * 2);
  }
  writeFileSync(outPath, buf);
  return byteLength;
}

// ---------- Synthesis helpers ----------

/** Pitch (Hz) for standard scientific notation. */
const PITCH = {
  D3: 146.832,
  F3: 174.614,
  G3: 195.998,
  A3: 220.0,
  C4: 261.626,
  D4: 293.665,
  F4: 349.228,
  A4: 440.0,
};

/** ADSR envelope at time t (seconds) given duration + ADSR params. */
function adsr(t, dur, a, d, sus, r) {
  if (t < 0) return 0;
  if (t >= dur) return 0;
  const releaseStart = dur - r;
  if (t < a) return t / a;
  if (t < a + d) return 1 - (1 - sus) * ((t - a) / d);
  if (t < releaseStart) return sus;
  return sus * (1 - (t - releaseStart) / r);
}

/** Karplus-Strong-lite pluck: detuned sine cluster with a pluck envelope. */
function pluckNote(freq, durSec, amp = 0.4) {
  const N = Math.floor(durSec * SAMPLE_RATE);
  const out = new Float32Array(N);
  // Three slightly detuned sines for nylon-string warmth.
  const detunes = [1.0, 1.005, 0.998];
  const weights = [0.6, 0.25, 0.15];
  // Pluck envelope: very fast attack, long release.
  const A = 0.005,
    D = 0.08,
    SUS = 0.3,
    R = durSec * 0.85;
  for (let i = 0; i < N; i += 1) {
    const t = i / SAMPLE_RATE;
    const env = adsr(t, durSec, A, D, SUS, R);
    let s = 0;
    for (let k = 0; k < detunes.length; k += 1) {
      s += weights[k] * Math.sin(2 * Math.PI * freq * detunes[k] * t);
    }
    // Pluck "click" — narrow noise burst in the first 20ms.
    if (t < 0.02) {
      s += (Math.random() * 2 - 1) * 0.15 * (1 - t / 0.02);
    }
    out[i] = amp * env * s;
  }
  return out;
}

/** Pad voice: multiple low-amplitude sines with slow LFO detune (tape wobble). */
function padTone(freqs, durSec, amp = 0.18) {
  const N = Math.floor(durSec * SAMPLE_RATE);
  const out = new Float32Array(N);
  // Slow attack/release for ambience.
  const A = 0.8,
    D = 0.4,
    SUS = 0.8,
    R = 1.5;
  for (let i = 0; i < N; i += 1) {
    const t = i / SAMPLE_RATE;
    const env = adsr(t, durSec, A, D, SUS, R);
    // Tape wobble — 0.4Hz, ±2 cents.
    const wobble = 1 + 0.0023 * Math.sin(2 * Math.PI * 0.4 * t);
    let s = 0;
    for (let k = 0; k < freqs.length; k += 1) {
      const f = freqs[k] * wobble;
      // Fundamental + a quieter octave.
      s += 0.7 * Math.sin(2 * Math.PI * f * t);
      s += 0.15 * Math.sin(2 * Math.PI * f * 2 * t);
    }
    // Tape hiss.
    const hiss = (Math.random() * 2 - 1) * 0.012;
    out[i] = amp * env * (s / freqs.length) + hiss;
  }
  return out;
}

/** Sequence of pluck notes for the mandolin flourish. */
function arpeggio(notes, perNoteSec, gapSec, amp = 0.42) {
  const totalSec = notes.length * (perNoteSec + gapSec);
  const N = Math.floor(totalSec * SAMPLE_RATE);
  const out = new Float32Array(N);
  for (let n = 0; n < notes.length; n += 1) {
    const noteStart = n * (perNoteSec + gapSec);
    const noteSamples = pluckNote(notes[n], perNoteSec + gapSec * 1.4, amp);
    const offset = Math.floor(noteStart * SAMPLE_RATE);
    for (let i = 0; i < noteSamples.length; i += 1) {
      if (offset + i >= N) break;
      out[offset + i] += noteSamples[i];
    }
  }
  return out;
}

// ---------- Render the three samples ----------

const samples = [
  {
    file: 'nylon-pluck-d3.wav',
    samples: pluckNote(PITCH.D3, 1.6, 0.38),
    desc: 'D3 nylon-string pluck',
  },
  {
    file: 'tape-ambient-d-min.wav',
    // D minor pentatonic stack — sustained, loopable (~6s).
    samples: padTone([PITCH.D3, PITCH.F3, PITCH.A3, PITCH.C4], 6.0, 0.16),
    desc: 'D-min pentatonic ambient pad (loop)',
  },
  {
    file: 'mandolin-flourish-d-min.wav',
    samples: arpeggio(
      [PITCH.D3, PITCH.F3, PITCH.A3, PITCH.D4, PITCH.F4, PITCH.A4],
      0.16,
      0.08,
      0.36,
    ),
    desc: 'D-min ascending arpeggio (mandolin-ish)',
  },
];

console.log(`Rendering 3 procedural samples → ${OUT_DIR}`);
for (const s of samples) {
  const outPath = resolve(OUT_DIR, s.file);
  const bytes = writeWav(s.samples, outPath);
  const seconds = (s.samples.length / SAMPLE_RATE).toFixed(2);
  console.log(
    `  ✔ ${s.file.padEnd(34)} ${(bytes / 1024).toFixed(1).padStart(7)} KB · ${seconds}s · ${s.desc}`,
  );
}
console.log('done.');
