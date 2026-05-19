/**
 * CalibratingScreen — the post-setup "personalising your experience"
 * interstitial.
 *
 * Shown once onboarding completes (generate or skip), just before the
 * redirect. It reads the Travel Aura the user just derived so the
 * personalisation feels real, not theatrical ("Tuning for The
 * Explorer…"), ticks through a short sequence over a calm gold
 * progress ring, then hands back via onDone().
 *
 * Honest + robust: it's a fixed-duration animation, not a fake
 * progress bar pretending to do work — the real work (trip create +
 * AI plan) was already fired and continues in the background. $0, no
 * deps beyond framer-motion. prefers-reduced-motion collapses it to a
 * brief static beat so no one is trapped behind motion.
 *
 * Installed for Phase 1 — Onboarding & Identity (P1.4).
 */
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { AURAS, getAuraDraft } from '../../lib/travel-aura';
import { CinematicAuthBackground } from '../auth/cinematic-auth-background';

export interface CalibratingScreenProps {
  /** Called exactly once when the sequence finishes. */
  readonly onDone: () => void;
}

const R = 52;
const CIRC = 2 * Math.PI * R;

export function CalibratingScreen({ onDone }: CalibratingScreenProps) {
  const reduce = useReducedMotion();
  const firedRef = useRef(false);
  const [stepIdx, setStepIdx] = useState(0);

  const draft = useMemo(() => getAuraDraft(), []);
  const aura = draft ? AURAS[draft.aura] : null;
  const accent = aura?.accent ?? '#cdab63';

  const steps = useMemo(() => {
    const s: string[] = ['Reading your travel style'];
    s.push(aura ? `Tuning recommendations for ${aura.name}` : 'Tuning your recommendations');
    s.push(
      draft?.home
        ? `Mapping journeys from ${draft.home.label.split(',')[0]}`
        : 'Calibrating your map',
    );
    s.push(
      draft && draft.interests.length > 0
        ? `Weaving in ${draft.interests.length} interests`
        : 'Priming your AI travel companion',
    );
    s.push('Almost ready');
    return s;
  }, [aura, draft]);

  // Drive the sequence. Reduced-motion → one short beat then done.
  useEffect(() => {
    const finish = () => {
      if (firedRef.current) return;
      firedRef.current = true;
      onDone();
    };
    if (reduce) {
      const t = window.setTimeout(finish, 600);
      return () => window.clearTimeout(t);
    }
    const per = 720;
    const timers: number[] = [];
    for (let i = 1; i < steps.length; i += 1) {
      timers.push(window.setTimeout(() => setStepIdx(i), per * i));
    }
    timers.push(window.setTimeout(finish, per * steps.length + 500));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [reduce, steps.length, onDone]);

  const progress = reduce ? 1 : Math.min(1, (stepIdx + 1) / steps.length);

  return (
    <main
      className="fixed inset-0 z-50 grid place-items-center overflow-hidden px-6"
      aria-busy="true"
    >
      {/* Same world as the rest of setup — continuity until done. */}
      <CinematicAuthBackground />
      <div aria-hidden className="absolute inset-0" style={{ background: 'rgba(2,3,10,0.6)' }} />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-112 w-md -translate-x-1/2 -translate-y-1/2 rounded-full blur-[120px]"
        style={{ background: `${accent}33` }}
      />

      <div className="relative flex flex-col items-center text-center">
        <div className="relative h-36 w-36">
          <svg className="h-36 w-36 -rotate-90" viewBox="0 0 120 120">
            <circle
              cx="60"
              cy="60"
              r={R}
              fill="none"
              stroke="rgba(255,255,255,0.12)"
              strokeWidth="4"
            />
            <circle
              cx="60"
              cy="60"
              r={R}
              fill="none"
              stroke={accent}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={CIRC}
              strokeDashoffset={CIRC * (1 - progress)}
              style={{ transition: reduce ? undefined : 'stroke-dashoffset 0.7s ease' }}
            />
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            <motion.span
              className="text-4xl"
              animate={reduce ? undefined : { scale: [1, 1.12, 1] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            >
              {aura?.emoji ?? '✨'}
            </motion.span>
          </div>
        </div>

        <p className="mt-7 text-xs font-semibold uppercase tracking-[0.2em] text-gold-300">
          Calibrating your experience
        </p>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          {aura ? `Personalising for ${aura.name}` : 'Personalising your travel companion'}
        </h1>

        <div className="mt-4 h-6" aria-live="polite">
          <motion.p
            key={stepIdx}
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="text-sm text-white/70"
          >
            {steps[Math.min(stepIdx, steps.length - 1)]}…
          </motion.p>
        </div>
      </div>
    </main>
  );
}
