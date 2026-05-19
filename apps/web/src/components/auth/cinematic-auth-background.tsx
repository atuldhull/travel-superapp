/**
 * CinematicAuthBackground — a calm, premium, real-time scene that
 * sits behind the whole auth/setup flow.
 *
 * Composition (back → front): a sky that tracks the device clock
 * (night · dawn · day · dusk), a sun or moon with a soft glow + a
 * water reflection, twinkling stars after dark, layered mountain
 * ridges across the far side, a road on which a single car drifts
 * left → right forever, slow clouds, and a foreground river/ocean
 * that shimmers. A cinematic vignette focuses the eye on the card.
 *
 * Honest + robust: pure CSS/SVG (no images, no network — $0, works
 * offline, can't fail to load), `prefers-reduced-motion` freezes all
 * motion, and the nature ambience is procedural Web Audio behind an
 * opt-in toggle (browser autoplay rules) whose choice is remembered.
 *
 * Rendered by AuthShell so it persists across /login, /register and
 * every forgot/reset/mfa sub-page until the user is in.
 *
 * Installed for Phase 1 — Onboarding & Identity (cinematic login).
 */
'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import {
  ambientPreferred,
  ambientRunning,
  ambientStart,
  ambientStop,
  ambientSupported,
} from '../../lib/ambient-audio';

type Phase = 'night' | 'dawn' | 'day' | 'dusk';

function phaseForHour(h: number): Phase {
  if (h >= 5 && h < 7) return 'dawn';
  if (h >= 7 && h < 17) return 'day';
  if (h >= 17 && h < 19) return 'dusk';
  return 'night';
}

// On-brand palettes (deep ink + champagne gold) — premium, not garish.
const PALETTE: Record<Phase, Record<string, string>> = {
  night: {
    '--sky-a': '#060a1e',
    '--sky-b': '#0b1030',
    '--sky-c': '#1a1f44',
    '--mtn-far': '#0c1130',
    '--mtn-near': '#070a20',
    '--water-a': '#0c1234',
    '--water-b': '#05070f',
    '--orb': '#ece5c8',
    '--orb-glow': 'rgba(236,229,200,0.45)',
    '--stars': '1',
    '--headlight': '1',
  },
  dawn: {
    '--sky-a': '#141a3c',
    '--sky-b': '#4a3a63',
    '--sky-c': '#c98a5a',
    '--mtn-far': '#33264a',
    '--mtn-near': '#221a39',
    '--water-a': '#243049',
    '--water-b': '#0d1326',
    '--orb': '#ffd9a0',
    '--orb-glow': 'rgba(255,201,141,0.5)',
    '--stars': '0.28',
    '--headlight': '0.6',
  },
  day: {
    '--sky-a': '#24365c',
    '--sky-b': '#4f73a4',
    '--sky-c': '#d8c7a4',
    '--mtn-far': '#3f4f73',
    '--mtn-near': '#2e3b5e',
    '--water-a': '#2c4368',
    '--water-b': '#16243d',
    '--orb': '#fff1d2',
    '--orb-glow': 'rgba(255,236,193,0.5)',
    '--stars': '0',
    '--headlight': '0',
  },
  dusk: {
    '--sky-a': '#1c2142',
    '--sky-b': '#5b2f57',
    '--sky-c': '#c56a48',
    '--mtn-far': '#341f3f',
    '--mtn-near': '#241a36',
    '--water-a': '#221a30',
    '--water-b': '#0c0a18',
    '--orb': '#ff9d6b',
    '--orb-glow': 'rgba(255,140,90,0.5)',
    '--stars': '0.35',
    '--headlight': '0.7',
  },
};

// A scattered, deterministic star field (no layout cost — box-shadows).
const STAR_SHADOW = (() => {
  let seed = 7;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const out: string[] = [];
  for (let i = 0; i < 70; i += 1) {
    const x = (rnd() * 100).toFixed(2);
    const y = (rnd() * 52).toFixed(2);
    const a = (0.35 + rnd() * 0.6).toFixed(2);
    out.push(`${x}vw ${y}vh 0 0 rgba(255,253,245,${a})`);
  }
  return out.join(',');
})();

export function CinematicAuthBackground() {
  const [phase, setPhase] = useState<Phase>('day');
  const [reduced, setReduced] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [canSound, setCanSound] = useState(false);

  // Track the real clock — re-evaluate every minute so a lingering
  // user sees the scene cross dusk into night.
  useEffect(() => {
    const tick = () => setPhase(phaseForHour(new Date().getHours()));
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  // Ambient sound: reflect remembered preference. Browsers block audio
  // until a gesture, so if it was on, resume on the first interaction.
  useEffect(() => {
    if (!ambientSupported()) return;
    setCanSound(true);
    setSoundOn(ambientRunning());
    if (ambientPreferred() && !ambientRunning()) {
      const resume = () => {
        void ambientStart(false);
        setSoundOn(true);
        window.removeEventListener('pointerdown', resume);
      };
      window.addEventListener('pointerdown', resume, { once: true });
      return () => window.removeEventListener('pointerdown', resume);
    }
    return;
  }, []);

  const toggleSound = () => {
    if (soundOn) {
      ambientStop();
      setSoundOn(false);
    } else {
      void ambientStart();
      setSoundOn(true);
    }
  };

  const vars = { ...PALETTE[phase] } as CSSProperties;
  const motion = !reduced;

  return (
    <>
      <style>{KEYFRAMES}</style>
      <div aria-hidden className="fixed inset-0 -z-10 overflow-hidden" style={vars}>
        {/* Sky */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, var(--sky-a) 0%, var(--sky-b) 38%, var(--sky-c) 62%)',
            transition: 'background 2s ease',
          }}
        />
        {/* Stars */}
        <div
          className="absolute left-0 top-0 h-1 w-1 rounded-full"
          style={{
            boxShadow: STAR_SHADOW,
            opacity: 'var(--stars)',
            transition: 'opacity 2s ease',
            animation: motion ? 'cabTwinkle 5.5s ease-in-out infinite' : undefined,
          }}
        />
        {/* Sun / Moon + glow */}
        <div
          className="absolute"
          style={{
            left: '64%',
            top: '16%',
            width: '92px',
            height: '92px',
            borderRadius: '9999px',
            background:
              'radial-gradient(circle at 50% 50%, var(--orb) 0%, var(--orb) 60%, transparent 72%)',
            boxShadow: '0 0 90px 30px var(--orb-glow), 0 0 200px 80px var(--orb-glow)',
            transition: 'background 2s ease, box-shadow 2s ease',
          }}
        />
        {/* Mountains (far → near) */}
        <svg
          className="absolute inset-x-0"
          style={{ top: '34%', height: '32%', width: '100%' }}
          viewBox="0 0 1440 320"
          preserveAspectRatio="none"
        >
          <path
            d="M0 220 L210 110 L420 210 L640 70 L860 200 L1080 120 L1280 210 L1440 150 L1440 320 L0 320 Z"
            fill="var(--mtn-far)"
            opacity="0.75"
          />
          <path
            d="M0 300 L180 200 L360 280 L560 170 L780 270 L1000 190 L1220 285 L1440 215 L1440 320 L0 320 Z"
            fill="var(--mtn-near)"
          />
        </svg>
        {/* Clouds */}
        {(['day', 'dawn', 'dusk'] as Phase[]).includes(phase) && (
          <>
            <div
              className="absolute rounded-full"
              style={{
                top: '14%',
                left: '-20%',
                width: '260px',
                height: '60px',
                background: 'rgba(255,255,255,0.10)',
                filter: 'blur(22px)',
                animation: motion ? 'cabDrift 90s linear infinite' : undefined,
              }}
            />
            <div
              className="absolute rounded-full"
              style={{
                top: '24%',
                left: '-30%',
                width: '200px',
                height: '46px',
                background: 'rgba(255,255,255,0.07)',
                filter: 'blur(20px)',
                animation: motion ? 'cabDrift 130s linear infinite' : undefined,
              }}
            />
          </>
        )}
        {/* Road + travelling car (just above the waterline) */}
        <div className="absolute inset-x-0" style={{ top: '60.5%', height: '2.5%' }}>
          <div
            className="absolute inset-x-0 top-1/2"
            style={{
              height: '2px',
              background:
                'linear-gradient(90deg, transparent, rgba(205,171,99,0.35) 12%, rgba(205,171,99,0.35) 88%, transparent)',
            }}
          />
          <div
            className="absolute"
            style={{
              top: '-9px',
              left: '-8vw',
              animation: motion ? 'cabDrive 26s linear infinite' : undefined,
              transform: motion ? undefined : 'translateX(46vw)',
            }}
          >
            <div style={{ position: 'relative', width: '34px', height: '14px' }}>
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  width: '34px',
                  height: '9px',
                  borderRadius: '3px',
                  background: '#11152e',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.5)',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  bottom: '6px',
                  left: '7px',
                  width: '18px',
                  height: '7px',
                  borderRadius: '4px 4px 0 0',
                  background: '#1b2347',
                }}
              />
              <span
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: '4px',
                  width: '6px',
                  height: '6px',
                  borderRadius: '9999px',
                  background: '#05060f',
                }}
              />
              <span
                style={{
                  position: 'absolute',
                  bottom: 0,
                  right: '4px',
                  width: '6px',
                  height: '6px',
                  borderRadius: '9999px',
                  background: '#05060f',
                }}
              />
              <span
                style={{
                  position: 'absolute',
                  bottom: '3px',
                  right: '-2px',
                  width: '26px',
                  height: '10px',
                  borderRadius: '9999px',
                  background:
                    'radial-gradient(ellipse at left, rgba(255,228,160,0.8), transparent 70%)',
                  opacity: 'var(--headlight)',
                  filter: 'blur(1px)',
                }}
              />
            </div>
          </div>
        </div>
        {/* Water / ocean with the orb's reflection */}
        <div
          className="absolute inset-x-0 bottom-0"
          style={{
            top: '62%',
            background: 'linear-gradient(180deg, var(--water-a) 0%, var(--water-b) 100%)',
            transition: 'background 2s ease',
          }}
        >
          <div
            className="absolute"
            style={{
              left: '62%',
              top: 0,
              width: '120px',
              height: '100%',
              transform: 'translateX(-50%)',
              background: 'linear-gradient(180deg, var(--orb-glow), transparent 70%)',
              filter: 'blur(7px)',
              opacity: 0.7,
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                'repeating-linear-gradient(180deg, rgba(255,255,255,0.05) 0 1px, transparent 1px 7px)',
              animation: motion ? 'cabRipple 7s ease-in-out infinite' : undefined,
              opacity: 0.6,
            }}
          />
        </div>
        {/* Cinematic vignette */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(120% 90% at 50% 38%, transparent 40%, rgba(3,4,12,0.55) 100%)',
          }}
        />
      </div>

      {canSound && (
        <button
          type="button"
          onClick={toggleSound}
          aria-pressed={soundOn}
          aria-label={soundOn ? 'Mute ambient sound' : 'Play calming ambient sound'}
          className="fixed bottom-4 right-4 z-50 inline-flex items-center gap-2 rounded-full border border-gold-500/40 bg-black/45 px-3.5 py-2 text-xs font-medium text-gold-200 backdrop-blur-sm transition hover:bg-black/65 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {soundOn ? (
            <Volume2 aria-hidden className="h-4 w-4" />
          ) : (
            <VolumeX aria-hidden className="h-4 w-4" />
          )}
          {soundOn ? 'Ambience on' : 'Ambience'}
        </button>
      )}
    </>
  );
}

const KEYFRAMES = `
@keyframes cabDrive { 0% { transform: translateX(-8vw) } 100% { transform: translateX(112vw) } }
@keyframes cabDrift { 0% { transform: translateX(0) } 100% { transform: translateX(150vw) } }
@keyframes cabTwinkle { 0%,100% { opacity: var(--stars) } 50% { opacity: calc(var(--stars) * 0.45) } }
@keyframes cabRipple { 0%,100% { transform: translateY(0) } 50% { transform: translateY(3px) } }
`;
