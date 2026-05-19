/**
 * CinematicAuthBackground — the continuous, real-time world that sits
 * behind the ENTIRE login → setup journey (auth pages, the traveller
 * quiz, the trip wizard, and the calibrating screen) until the user
 * is signed in or setup is done.
 *
 * Realism (all pure CSS/SVG — no images, no network: $0, offline,
 * can't fail): the sky tracks the real clock and the sun/moon ride a
 * true time-of-day arc (rise → zenith → set); a hazed third mountain
 * ridge adds aerial depth; deep night gets a denser star field with a
 * faint Milky-Way band; the foreground ocean carries the orb's
 * reflection with two cross-drifting shimmer layers; birds drift by
 * day; a single car eases left → right forever with headlights after
 * dusk. A cinematic vignette focuses the card.
 *
 * `prefers-reduced-motion` freezes all motion. The calming nature
 * ambience is procedural Web Audio behind an opt-in, remembered
 * toggle (browser autoplay rules).
 *
 * Installed for Phase 1 — Onboarding & Identity (cinematic login);
 * deepened + made flow-wide in the Phase-1 depth pass.
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
    '--sky-a': '#05081a',
    '--sky-b': '#0a0e2c',
    '--sky-c': '#161a40',
    '--haze': 'rgba(120,130,200,0.10)',
    '--mtn-far': '#10153a',
    '--mtn-mid': '#0c1130',
    '--mtn-near': '#070a1e',
    '--water-a': '#0b1130',
    '--water-b': '#04060e',
    '--orb': '#eee7cc',
    '--orb-glow': 'rgba(238,231,204,0.42)',
    '--stars': '1',
    '--mw': '0.5',
    '--headlight': '1',
    '--birds': '0',
  },
  dawn: {
    '--sky-a': '#121838',
    '--sky-b': '#4a3a63',
    '--sky-c': '#d39463',
    '--haze': 'rgba(255,200,150,0.18)',
    '--mtn-far': '#3a2d50',
    '--mtn-mid': '#2c2244',
    '--mtn-near': '#1d1733',
    '--water-a': '#283150',
    '--water-b': '#0d1226',
    '--orb': '#ffd9a0',
    '--orb-glow': 'rgba(255,201,141,0.5)',
    '--stars': '0.25',
    '--mw': '0',
    '--headlight': '0.55',
    '--birds': '1',
  },
  day: {
    '--sky-a': '#22345a',
    '--sky-b': '#4f73a4',
    '--sky-c': '#dac9a6',
    '--haze': 'rgba(255,250,235,0.22)',
    '--mtn-far': '#52638a',
    '--mtn-mid': '#3f4f73',
    '--mtn-near': '#2c3a5c',
    '--water-a': '#2c4368',
    '--water-b': '#16243d',
    '--orb': '#fff3d6',
    '--orb-glow': 'rgba(255,238,198,0.5)',
    '--stars': '0',
    '--mw': '0',
    '--headlight': '0',
    '--birds': '1',
  },
  dusk: {
    '--sky-a': '#191e40',
    '--sky-b': '#5b2f57',
    '--sky-c': '#c5663f',
    '--haze': 'rgba(255,150,90,0.20)',
    '--mtn-far': '#3c2542',
    '--mtn-mid': '#2e1c38',
    '--mtn-near': '#21162e',
    '--water-a': '#221a30',
    '--water-b': '#0b0916',
    '--orb': '#ff9d6b',
    '--orb-glow': 'rgba(255,140,90,0.5)',
    '--stars': '0.32',
    '--mw': '0',
    '--headlight': '0.65',
    '--birds': '1',
  },
};

// Deterministic star field (no layout cost — box-shadows).
const STAR_SHADOW = (() => {
  let seed = 7;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const out: string[] = [];
  for (let i = 0; i < 110; i += 1) {
    const x = (rnd() * 100).toFixed(2);
    const y = (rnd() * 54).toFixed(2);
    const a = (0.3 + rnd() * 0.65).toFixed(2);
    out.push(`${x}vw ${y}vh 0 0 rgba(255,253,245,${a})`);
  }
  return out.join(',');
})();

// Sun/moon ride a real arc: rise low at the start of their window,
// peak mid-window, set low at the end. Returns viewport %s.
function orbPosition(hourFloat: number, phase: Phase): { leftPct: number; topPct: number } {
  let frac: number; // 0 (rising) → 1 (setting)
  if (phase === 'night') {
    // Moon spans 19:00 → 05:00 (wrap).
    const n = hourFloat >= 19 ? hourFloat - 19 : hourFloat + 5;
    frac = Math.min(1, Math.max(0, n / 10));
  } else {
    // Sun spans ~05:30 → 18:30.
    frac = Math.min(1, Math.max(0, (hourFloat - 5.5) / 13));
  }
  const leftPct = 8 + frac * 80;
  // Arc height: low at the edges, high at the zenith.
  const topPct = 46 - Math.sin(frac * Math.PI) * 36;
  return { leftPct, topPct };
}

export function CinematicAuthBackground() {
  const [phase, setPhase] = useState<Phase>('day');
  const [hourFloat, setHourFloat] = useState(12);
  const [reduced, setReduced] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [canSound, setCanSound] = useState(false);

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      const hf = d.getHours() + d.getMinutes() / 60;
      setHourFloat(hf);
      setPhase(phaseForHour(d.getHours()));
    };
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
  const orb = orbPosition(hourFloat, phase);
  const isMoon = phase === 'night';

  return (
    <>
      <style>{KEYFRAMES}</style>
      <div aria-hidden className="fixed inset-0 -z-10 overflow-hidden" style={vars}>
        {/* Sky */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, var(--sky-a) 0%, var(--sky-b) 40%, var(--sky-c) 62%)',
            transition: 'background 2.5s ease',
          }}
        />
        {/* Milky-Way band (deep night only) */}
        <div
          className="absolute"
          style={{
            top: '-10%',
            left: '-20%',
            width: '140%',
            height: '80%',
            transform: 'rotate(-18deg)',
            background:
              'radial-gradient(ellipse 60% 16% at 50% 50%, rgba(200,210,255,0.10), transparent 70%)',
            opacity: 'var(--mw)',
            transition: 'opacity 2.5s ease',
          }}
        />
        {/* Stars */}
        <div
          className="absolute left-0 top-0 h-1 w-1 rounded-full"
          style={{
            boxShadow: STAR_SHADOW,
            opacity: 'var(--stars)',
            transition: 'opacity 2.5s ease',
            animation: motion ? 'cabTwinkle 6s ease-in-out infinite' : undefined,
          }}
        />
        {/* Sun / Moon on its real arc + bloom */}
        <div
          className="absolute"
          style={{
            left: `${orb.leftPct}%`,
            top: `${orb.topPct}%`,
            width: '86px',
            height: '86px',
            borderRadius: '9999px',
            background: isMoon
              ? 'radial-gradient(circle at 38% 38%, var(--orb) 0%, var(--orb) 58%, rgba(210,205,180,0.85) 64%, transparent 72%)'
              : 'radial-gradient(circle at 50% 50%, #fff 0%, var(--orb) 45%, var(--orb) 60%, transparent 72%)',
            boxShadow: '0 0 70px 26px var(--orb-glow), 0 0 170px 80px var(--orb-glow)',
            transition: 'left 60s linear, top 60s linear, background 2.5s ease',
          }}
        />
        {/* Aerial-perspective haze at the horizon */}
        <div
          className="absolute inset-x-0"
          style={{
            top: '46%',
            height: '20%',
            background: 'linear-gradient(180deg, transparent, var(--haze) 65%, transparent)',
            transition: 'background 2.5s ease',
          }}
        />
        {/* Mountains: far (hazed) → mid → near */}
        <svg
          className="absolute inset-x-0"
          style={{ top: '33%', height: '34%', width: '100%' }}
          viewBox="0 0 1440 340"
          preserveAspectRatio="none"
        >
          <path
            d="M0 250 L240 150 L470 235 L700 120 L960 230 L1200 150 L1440 225 L1440 340 L0 340 Z"
            fill="var(--mtn-far)"
            opacity="0.55"
            style={{ filter: 'blur(1.5px)' }}
          />
          <path
            d="M0 280 L210 175 L430 265 L660 140 L900 255 L1140 175 L1440 250 L1440 340 L0 340 Z"
            fill="var(--mtn-mid)"
            opacity="0.85"
          />
          <path
            d="M0 320 L180 225 L380 300 L580 200 L820 295 L1040 215 L1260 300 L1440 240 L1440 340 L0 340 Z"
            fill="var(--mtn-near)"
          />
        </svg>
        {/* Birds (day/dawn/dusk) */}
        <div
          className="absolute"
          style={{
            top: '22%',
            left: '-6%',
            opacity: 'var(--birds)',
            transition: 'opacity 2.5s ease',
          }}
        >
          <div style={{ animation: motion ? 'cabBirds 60s linear infinite' : undefined }}>
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                style={{
                  position: 'absolute',
                  top: `${i * 9 - (i % 2) * 4}px`,
                  left: `${i * 26}px`,
                  width: '12px',
                  height: '6px',
                  borderTop: '1.5px solid rgba(20,22,40,0.5)',
                  borderRadius: '60% 60% 0 0',
                  transform: 'rotate(-8deg)',
                }}
              />
            ))}
          </div>
        </div>
        {/* Road + travelling car */}
        <div className="absolute inset-x-0" style={{ top: '60.5%', height: '2.5%' }}>
          <div
            className="absolute inset-x-0 top-1/2"
            style={{
              height: '2px',
              background:
                'linear-gradient(90deg, transparent, rgba(205,171,99,0.32) 12%, rgba(205,171,99,0.32) 88%, transparent)',
            }}
          />
          <div
            className="absolute"
            style={{
              top: '-9px',
              left: '-8vw',
              animation: motion ? 'cabDrive 30s linear infinite' : undefined,
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
                  background: '#0f1430',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.55)',
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
                  background: '#1a2247',
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
                  right: '-3px',
                  width: '30px',
                  height: '10px',
                  borderRadius: '9999px',
                  background:
                    'radial-gradient(ellipse at left, rgba(255,228,160,0.85), transparent 70%)',
                  opacity: 'var(--headlight)',
                  filter: 'blur(1px)',
                }}
              />
            </div>
          </div>
        </div>
        {/* Ocean + the orb's reflection + dual shimmer */}
        <div
          className="absolute inset-x-0 bottom-0"
          style={{
            top: '62%',
            background: 'linear-gradient(180deg, var(--water-a) 0%, var(--water-b) 100%)',
            transition: 'background 2.5s ease',
          }}
        >
          <div
            className="absolute"
            style={{
              left: `${orb.leftPct}%`,
              top: 0,
              width: '110px',
              height: '70%',
              transform: 'translateX(-50%)',
              background: 'linear-gradient(180deg, var(--orb-glow), transparent 75%)',
              filter: 'blur(8px)',
              opacity: 0.7,
              transition: 'left 60s linear',
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                'repeating-linear-gradient(180deg, rgba(255,255,255,0.05) 0 1px, transparent 1px 8px)',
              animation: motion ? 'cabRipple 8s ease-in-out infinite' : undefined,
              opacity: 0.55,
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                'repeating-linear-gradient(180deg, rgba(255,255,255,0.035) 0 1px, transparent 1px 13px)',
              animation: motion ? 'cabRipple2 12s ease-in-out infinite' : undefined,
              opacity: 0.5,
            }}
          />
        </div>
        {/* Cinematic vignette */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(120% 95% at 50% 36%, transparent 38%, rgba(2,3,10,0.6) 100%)',
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
@keyframes cabBirds { 0% { transform: translate(0,0) } 100% { transform: translate(116vw,-6vh) } }
@keyframes cabTwinkle { 0%,100% { opacity: var(--stars) } 50% { opacity: calc(var(--stars) * 0.5) } }
@keyframes cabRipple { 0%,100% { transform: translateY(0) } 50% { transform: translateY(3px) } }
@keyframes cabRipple2 { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-4px) } }
`;
