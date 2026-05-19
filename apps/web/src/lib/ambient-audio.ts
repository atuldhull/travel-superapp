/**
 * ambient-audio — calming nature ambience for the cinematic auth
 * scene, synthesised entirely with the Web Audio API.
 *
 * Why procedural and not an audio file: zero asset to ship/stream
 * ($0, works fully offline), no licensing, and it loops forever with
 * no seam. It models gentle water/wind: looped filtered noise with a
 * slow swelling gain (the "waves") plus a soft high breeze layer.
 *
 * Browser autoplay rules forbid sound before a user gesture, so this
 * is opt-in via a toggle and the preference is remembered. A single
 * module-level graph survives React remounts (the auth pages each
 * re-mount AuthShell as you move login → register → reset).
 */

const PREF_KEY = 'auth-ambient-on';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let started = false;
let running = false;
// Phase-modulated nodes (A3 — ambience tracks time of day).
let waterLpRef: BiquadFilterNode | null = null;
let breezeGainRef: GainNode | null = null;
let cricketGainRef: GainNode | null = null;

export type AmbientPhase = 'night' | 'dawn' | 'day' | 'dusk';

function buildNoiseBuffer(context: AudioContext): AudioBuffer {
  // ~3 s of brown-ish noise (integrated white) — soft, water-like.
  const len = context.sampleRate * 3;
  const buf = context.createBuffer(1, len, context.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i += 1) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 3.2;
  }
  return buf;
}

function build(): void {
  if (started || typeof window === 'undefined') return;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return;
  ctx = new Ctor();
  master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);

  const noise = buildNoiseBuffer(ctx);

  // Water layer: low-passed noise with a slow swelling gain.
  const water = ctx.createBufferSource();
  water.buffer = noise;
  water.loop = true;
  const waterLp = ctx.createBiquadFilter();
  waterLp.type = 'lowpass';
  waterLp.frequency.value = 480;
  const waterGain = ctx.createGain();
  waterGain.gain.value = 0.5;
  const swell = ctx.createOscillator();
  swell.frequency.value = 0.07; // ~14 s wave period
  const swellAmt = ctx.createGain();
  swellAmt.gain.value = 0.28;
  swell.connect(swellAmt);
  swellAmt.connect(waterGain.gain);
  water.connect(waterLp);
  waterLp.connect(waterGain);
  waterGain.connect(master);

  // Breeze layer: gentle band-passed noise, very quiet.
  const breeze = ctx.createBufferSource();
  breeze.buffer = noise;
  breeze.loop = true;
  const breezeBp = ctx.createBiquadFilter();
  breezeBp.type = 'bandpass';
  breezeBp.frequency.value = 900;
  breezeBp.Q.value = 0.7;
  const breezeGain = ctx.createGain();
  breezeGain.gain.value = 0.06;
  breeze.connect(breezeBp);
  breezeBp.connect(breezeGain);
  breezeGain.connect(master);

  // Night cricket texture: a high, narrow band of the noise gated by a
  // fast tremolo — recognisably "night", calm at very low volume.
  // Silent until ambientSetPhase('night') ramps it in.
  const cricket = ctx.createBufferSource();
  cricket.buffer = noise;
  cricket.loop = true;
  const cricketBp = ctx.createBiquadFilter();
  cricketBp.type = 'bandpass';
  cricketBp.frequency.value = 4500;
  cricketBp.Q.value = 9;
  const cricketGain = ctx.createGain();
  cricketGain.gain.value = 0;
  const chirp = ctx.createOscillator();
  chirp.frequency.value = 6; // tremolo rate
  const chirpAmt = ctx.createGain();
  chirpAmt.gain.value = 0.5;
  chirp.connect(chirpAmt);
  chirpAmt.connect(cricketGain.gain);
  cricket.connect(cricketBp);
  cricketBp.connect(cricketGain);
  cricketGain.connect(master);

  waterLpRef = waterLp;
  breezeGainRef = breezeGain;
  cricketGainRef = cricketGain;

  water.start();
  breeze.start();
  swell.start();
  cricket.start();
  chirp.start();
  started = true;
}

/**
 * Re-tune the ambience to the time of day. Smooth ramps so a phase
 * crossing while a user lingers is seamless. No-op until built.
 */
export function ambientSetPhase(phase: AmbientPhase): void {
  if (!ctx) return;
  const t = ctx.currentTime;
  const ramp = (p: AudioParam, v: number) => {
    p.cancelScheduledValues(t);
    p.setValueAtTime(p.value, t);
    p.linearRampToValueAtTime(v, t + 2.5);
  };
  const night = phase === 'night';
  if (waterLpRef) ramp(waterLpRef.frequency, night ? 360 : phase === 'day' ? 540 : 460);
  if (breezeGainRef) ramp(breezeGainRef.gain, phase === 'day' ? 0.085 : night ? 0.035 : 0.06);
  // Cricket tremolo centre — actual audible level is this × the chirp
  // LFO, so keep the centre small.
  if (cricketGainRef) ramp(cricketGainRef.gain, night ? 0.05 : phase === 'dusk' ? 0.02 : 0);
}

export function ambientSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext,
  );
}

export function ambientPreferred(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(PREF_KEY) === '1';
  } catch {
    return false;
  }
}

export async function ambientStart(remember = true): Promise<void> {
  build();
  if (!ctx || !master) return;
  if (ctx.state === 'suspended') await ctx.resume();
  master.gain.cancelScheduledValues(ctx.currentTime);
  master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
  master.gain.linearRampToValueAtTime(0.09, ctx.currentTime + 1.4);
  running = true;
  if (remember) {
    try {
      window.localStorage.setItem(PREF_KEY, '1');
    } catch {
      /* private mode — non-fatal */
    }
  }
}

export function ambientStop(remember = true): void {
  running = false;
  if (ctx && master) {
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
    master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6);
  }
  if (remember) {
    try {
      window.localStorage.setItem(PREF_KEY, '0');
    } catch {
      /* non-fatal */
    }
  }
}

export function ambientRunning(): boolean {
  return running;
}
