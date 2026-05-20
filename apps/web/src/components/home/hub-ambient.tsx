/**
 * HubAmbient — calm CSS-only backdrop for /home.
 *
 * D6 shipped the static gold/royal/accent mesh; H1 (Phase 4) makes
 * it react to the destination's weather + local hour so the hub
 * feels alive without ever needing JS animation.
 *
 * Honest scope:
 *   • Pure CSS keyframes drift the three blobs slowly (no JS loop,
 *     no canvas, no deps).
 *   • `prefers-reduced-motion` freezes the drift (mood colours stay).
 *   • Sits `fixed inset-0 -z-10`, aria-hidden, pointer-events-none —
 *     never affects layout / focus / clicks.
 *   • Mood is best-effort: if /home doesn't know the weather yet, we
 *     show the calm default. Never breaks.
 *
 * Mood palette:
 *   calm    — original gold + royal + accent (default + when no signal)
 *   sunny   — warm gold + amber + cream (WMO 0/1, daytime)
 *   cloudy  — cool grey-blue + muted gold (WMO 2/3/45/48)
 *   rainy   — deep blue + violet + cool gold (WMO 51-67/80-82)
 *   snowy   — pale icy-blue + white-cream (WMO 71-77/85-86)
 *   thunder — dramatic violet + indigo (WMO 95-99)
 *   night   — deep ink + muted purple (any weather, hour 21-05)
 *   dawn    — warm coral + amber (hour 5-7)
 *   dusk    — deep pink + violet (hour 18-21)
 *
 * Installed for Phase 2 — Homepage hub (D6). Extended H1.
 */
'use client';

export type AmbientMood =
  | 'calm'
  | 'sunny'
  | 'cloudy'
  | 'rainy'
  | 'snowy'
  | 'thunder'
  | 'night'
  | 'dawn'
  | 'dusk';

interface MoodPalette {
  readonly wash: string; // The radial-gradient wash on the wrapper.
  readonly blobA: string; // top-left blob
  readonly blobB: string; // right blob
  readonly blobC: string; // bottom blob
}

/**
 * One source of truth for every mood's blob + wash colours. Each
 * mood is a single RGBA triple per slot so swapping moods is a
 * one-frame CSS variable update.
 */
const MOOD_PALETTES: Readonly<Record<AmbientMood, MoodPalette>> = {
  calm: {
    wash:
      'radial-gradient(1200px 700px at 12% 8%, rgba(212,175,55,0.06), transparent 60%),' +
      'radial-gradient(900px 600px at 88% 92%, rgba(40,60,130,0.07), transparent 60%)',
    blobA: 'rgba(212,175,55,0.22)',
    blobB: 'rgba(40,60,130,0.20)',
    blobC: 'rgba(120,90,200,0.14)',
  },
  sunny: {
    wash:
      'radial-gradient(1200px 700px at 12% 8%, rgba(255,200,90,0.10), transparent 60%),' +
      'radial-gradient(900px 600px at 88% 92%, rgba(255,160,80,0.08), transparent 60%)',
    blobA: 'rgba(255,210,110,0.30)',
    blobB: 'rgba(255,160,80,0.22)',
    blobC: 'rgba(255,225,150,0.18)',
  },
  cloudy: {
    wash:
      'radial-gradient(1200px 700px at 12% 8%, rgba(170,180,200,0.10), transparent 60%),' +
      'radial-gradient(900px 600px at 88% 92%, rgba(120,140,170,0.08), transparent 60%)',
    blobA: 'rgba(180,190,210,0.22)',
    blobB: 'rgba(120,140,170,0.20)',
    blobC: 'rgba(212,175,55,0.10)',
  },
  rainy: {
    wash:
      'radial-gradient(1200px 700px at 12% 8%, rgba(60,90,150,0.12), transparent 60%),' +
      'radial-gradient(900px 600px at 88% 92%, rgba(80,60,140,0.10), transparent 60%)',
    blobA: 'rgba(80,120,180,0.28)',
    blobB: 'rgba(60,80,140,0.24)',
    blobC: 'rgba(120,90,200,0.18)',
  },
  snowy: {
    wash:
      'radial-gradient(1200px 700px at 12% 8%, rgba(220,235,250,0.14), transparent 60%),' +
      'radial-gradient(900px 600px at 88% 92%, rgba(180,205,235,0.10), transparent 60%)',
    blobA: 'rgba(220,235,250,0.32)',
    blobB: 'rgba(180,205,235,0.24)',
    blobC: 'rgba(212,175,55,0.10)',
  },
  thunder: {
    wash:
      'radial-gradient(1200px 700px at 12% 8%, rgba(80,40,120,0.14), transparent 60%),' +
      'radial-gradient(900px 600px at 88% 92%, rgba(40,40,110,0.12), transparent 60%)',
    blobA: 'rgba(140,90,200,0.30)',
    blobB: 'rgba(60,60,140,0.26)',
    blobC: 'rgba(255,210,110,0.12)',
  },
  night: {
    wash:
      'radial-gradient(1200px 700px at 12% 8%, rgba(15,20,50,0.18), transparent 60%),' +
      'radial-gradient(900px 600px at 88% 92%, rgba(40,30,80,0.14), transparent 60%)',
    blobA: 'rgba(80,70,150,0.22)',
    blobB: 'rgba(40,40,110,0.20)',
    blobC: 'rgba(212,175,55,0.12)',
  },
  dawn: {
    wash:
      'radial-gradient(1200px 700px at 12% 8%, rgba(255,170,130,0.12), transparent 60%),' +
      'radial-gradient(900px 600px at 88% 92%, rgba(255,190,150,0.08), transparent 60%)',
    blobA: 'rgba(255,180,130,0.30)',
    blobB: 'rgba(255,150,120,0.22)',
    blobC: 'rgba(180,140,200,0.16)',
  },
  dusk: {
    wash:
      'radial-gradient(1200px 700px at 12% 8%, rgba(180,80,140,0.12), transparent 60%),' +
      'radial-gradient(900px 600px at 88% 92%, rgba(80,60,140,0.10), transparent 60%)',
    blobA: 'rgba(220,120,180,0.28)',
    blobB: 'rgba(120,80,180,0.22)',
    blobC: 'rgba(255,170,130,0.16)',
  },
};

/**
 * Compute the mood from {weather code, local hour 0..23}.
 * Hour wins for night/dawn/dusk; weather wins for daytime.
 *
 * @param code WMO weather code (0..99). `null` → no signal.
 * @param hour 0..23 in the destination's local timezone (or user's).
 */
export function pickAmbientMood(code: number | null, hour: number | null): AmbientMood {
  // Hour-based moods first (override daytime weather palettes).
  if (hour !== null) {
    if (hour >= 21 || hour < 5) return 'night';
    if (hour >= 5 && hour < 7) return 'dawn';
    if (hour >= 18 && hour < 21) return 'dusk';
  }
  // Daytime weather buckets (WMO codes — see weather-response.dto.ts).
  if (code === null) return 'calm';
  if (code === 0 || code === 1) return 'sunny';
  if (code === 2 || code === 3 || code === 45 || code === 48) return 'cloudy';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rainy';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snowy';
  if (code >= 95) return 'thunder';
  return 'calm';
}

interface Props {
  /** Override the mood. Defaults to `'calm'`. */
  readonly mood?: AmbientMood;
}

export function HubAmbient({ mood = 'calm' }: Props = {}) {
  const palette = MOOD_PALETTES[mood] ?? MOOD_PALETTES.calm;
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden transition-[background] duration-700 ease-out"
      style={{ background: palette.wash }}
    >
      <span
        className="hub-ambient-blob hub-ambient-blob--a"
        style={{ background: `radial-gradient(circle, ${palette.blobA}, transparent 70%)` }}
      />
      <span
        className="hub-ambient-blob hub-ambient-blob--b"
        style={{ background: `radial-gradient(circle, ${palette.blobB}, transparent 70%)` }}
      />
      <span
        className="hub-ambient-blob hub-ambient-blob--c"
        style={{ background: `radial-gradient(circle, ${palette.blobC}, transparent 70%)` }}
      />
      <style>{`
        .hub-ambient-blob {
          position: absolute;
          border-radius: 9999px;
          filter: blur(80px);
          opacity: 0.45;
          will-change: transform, background;
          transition: background 700ms ease-out;
        }
        .hub-ambient-blob--a {
          left: -10%; top: -8%;
          width: 42vw; height: 42vw;
          animation: hub-ambient-drift-a 28s ease-in-out infinite alternate;
        }
        .hub-ambient-blob--b {
          right: -12%; top: 30%;
          width: 38vw; height: 38vw;
          animation: hub-ambient-drift-b 32s ease-in-out infinite alternate;
        }
        .hub-ambient-blob--c {
          left: 30%; bottom: -14%;
          width: 46vw; height: 46vw;
          animation: hub-ambient-drift-c 36s ease-in-out infinite alternate;
        }
        @keyframes hub-ambient-drift-a {
          from { transform: translate3d(0, 0, 0) scale(1); }
          to   { transform: translate3d(6vw, 4vh, 0) scale(1.08); }
        }
        @keyframes hub-ambient-drift-b {
          from { transform: translate3d(0, 0, 0) scale(1); }
          to   { transform: translate3d(-5vw, -6vh, 0) scale(1.05); }
        }
        @keyframes hub-ambient-drift-c {
          from { transform: translate3d(0, 0, 0) scale(1); }
          to   { transform: translate3d(-4vw, 5vh, 0) scale(1.07); }
        }
        @media (prefers-reduced-motion: reduce) {
          .hub-ambient-blob {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
