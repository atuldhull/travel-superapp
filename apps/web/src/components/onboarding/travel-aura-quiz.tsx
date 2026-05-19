/**
 * TravelAuraQuiz — the new-user "what kind of traveller are you" flow.
 *
 * Short MCQ (one question per screen, taps auto-advance) → home
 * location + interests → an animated reveal of the user's Travel
 * Aura. The result + home + interests are handed up via onComplete;
 * the parent decides where it goes (localStorage bridge now, API in
 * P1.3). Skippable at any point.
 *
 * Premium + calm, on-brand, and prefers-reduced-motion safe (motion
 * collapses to instant). Reuses the existing $0 OSM PlaceSearch for
 * the home-location step.
 *
 * Installed for Phase 1 — Onboarding & Identity (traveller quiz).
 */
'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, Check, Sparkles } from 'lucide-react';
import { Button } from '../ui/button';
import { PlaceSearch } from '../nav/place-search';
import type { GeoPlace } from '../../lib/geocode';
import {
  AURAS,
  AURA_QUESTIONS,
  TRAVEL_INTERESTS,
  scoreAura,
  type AuraDraft,
} from '../../lib/travel-aura';

export interface TravelAuraQuizProps {
  readonly onComplete: (draft: AuraDraft) => void;
  readonly onSkip: () => void;
  readonly isBusy?: boolean;
}

type Stage = { kind: 'q'; i: number } | { kind: 'profile' } | { kind: 'result' };

export function TravelAuraQuiz({ onComplete, onSkip, isBusy }: TravelAuraQuizProps) {
  const reduce = useReducedMotion();
  const [stage, setStage] = useState<Stage>({ kind: 'q', i: 0 });
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [home, setHome] = useState<GeoPlace | null>(null);
  const [interests, setInterests] = useState<readonly string[]>([]);

  const total = AURA_QUESTIONS.length;
  const answeredCount = Object.keys(answers).length;
  const aura = useMemo(() => AURAS[scoreAura(answers)], [answers]);

  const fade = reduce
    ? {}
    : {
        initial: { opacity: 0, y: 14 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -14 },
        transition: { duration: 0.35, ease: 'easeOut' as const },
      };

  function pick(qIdx: number, optIdx: number) {
    const q = AURA_QUESTIONS[qIdx]!;
    setAnswers((a) => ({ ...a, [q.id]: optIdx }));
    if (qIdx + 1 < total) setStage({ kind: 'q', i: qIdx + 1 });
    else setStage({ kind: 'profile' });
  }

  function toggleInterest(label: string) {
    setInterests((cur) => (cur.includes(label) ? cur.filter((x) => x !== label) : [...cur, label]));
  }

  function finish() {
    const draft: AuraDraft = {
      aura: aura.id,
      answers,
      home: home ? { label: home.label, lat: home.lat, lng: home.lng } : null,
      interests,
      savedAt: Date.now(),
    };
    onComplete(draft);
  }

  // Progress: 6 questions + profile + result.
  const stepNo = stage.kind === 'q' ? stage.i : stage.kind === 'profile' ? total : total + 1;
  const stepsTotal = total + 2;

  return (
    <section className="space-y-7">
      <header className="space-y-2">
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-brand">
          <Sparkles aria-hidden className="h-3.5 w-3.5" /> Discover your travel style
        </p>
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {stage.kind === 'result' ? 'Your Travel Aura' : 'A few quick questions'}
        </h2>
        <p className="text-sm text-muted">
          {stage.kind === 'result'
            ? 'This shapes how the app plans, suggests, and feels for you. You can retake it anytime in Settings.'
            : 'Six taps. It tunes your recommendations from the very first trip.'}
        </p>
      </header>

      <ol className="flex items-center gap-1.5" aria-label="Quiz progress">
        {Array.from({ length: stepsTotal }).map((_, i) => (
          <li
            key={i}
            className={`h-1.5 flex-1 rounded-full transition ${
              i <= stepNo ? 'bg-brand' : 'bg-muted/20'
            }`}
            aria-current={i === stepNo ? 'step' : undefined}
          />
        ))}
      </ol>

      <AnimatePresence mode="wait">
        {stage.kind === 'q' && (
          <motion.div key={`q${stage.i}`} {...fade} className="space-y-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              Question {stage.i + 1} of {total}
            </p>
            <h3 className="text-xl font-semibold tracking-tight">
              {AURA_QUESTIONS[stage.i]!.prompt}
            </h3>
            <div className="grid gap-2.5">
              {AURA_QUESTIONS[stage.i]!.options.map((opt, oi) => {
                const sel = answers[AURA_QUESTIONS[stage.i]!.id] === oi;
                return (
                  <button
                    key={oi}
                    type="button"
                    onClick={() => pick(stage.i, oi)}
                    aria-pressed={sel}
                    className={
                      'flex items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 text-left text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ' +
                      (sel
                        ? 'border-brand bg-brand/10 text-surface-foreground shadow-(--shadow-depth-1)'
                        : 'border-gold-600/15 bg-surface hover:border-brand/40 hover:shadow-(--shadow-depth-1)')
                    }
                  >
                    <span>{opt.label}</span>
                    {sel ? <Check aria-hidden className="h-4 w-4 shrink-0 text-brand" /> : null}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => (stage.i === 0 ? onSkip() : setStage({ kind: 'q', i: stage.i - 1 }))}
                className="inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-surface-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {stage.i === 0 ? (
                  'Skip for now'
                ) : (
                  <>
                    <ArrowLeft aria-hidden className="h-4 w-4" /> Back
                  </>
                )}
              </button>
              <span className="text-xs text-muted">
                {answeredCount}/{total} answered
              </span>
            </div>
          </motion.div>
        )}

        {stage.kind === 'profile' && (
          <motion.div key="profile" {...fade} className="space-y-6">
            <div className="space-y-2">
              <h3 className="text-xl font-semibold tracking-tight">Where do you call home?</h3>
              <p className="text-sm text-muted">
                We use it for distances, time-from-home, and smarter suggestions. Optional.
              </p>
              <PlaceSearch
                label="Home city"
                placeholder="Search your city — e.g. Bengaluru, India"
                selected={home}
                onSelect={setHome}
              />
            </div>
            <div className="space-y-2.5">
              <h3 className="text-xl font-semibold tracking-tight">What pulls you to travel?</h3>
              <p className="text-sm text-muted">Pick any that fit — tunes recommendations.</p>
              <div className="flex flex-wrap gap-2">
                {TRAVEL_INTERESTS.map((label) => {
                  const on = interests.includes(label);
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => toggleInterest(label)}
                      aria-pressed={on}
                      className={
                        'rounded-full border px-3.5 py-1.5 text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ' +
                        (on
                          ? 'border-brand bg-brand/15 text-surface-foreground'
                          : 'border-gold-600/20 text-muted hover:border-brand/40 hover:text-surface-foreground')
                      }
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => setStage({ kind: 'q', i: total - 1 })}
                className="inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-surface-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <ArrowLeft aria-hidden className="h-4 w-4" /> Back
              </button>
              <Button type="button" variant="primary" onClick={() => setStage({ kind: 'result' })}>
                Reveal my Aura
              </Button>
            </div>
          </motion.div>
        )}

        {stage.kind === 'result' && (
          <motion.div key="result" {...fade} className="space-y-6">
            <motion.div
              initial={reduce ? false : { scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="relative overflow-hidden rounded-3xl border p-8 text-center shadow-(--shadow-depth-2)"
              style={{
                borderColor: `${aura.accent}55`,
                background: `radial-gradient(120% 120% at 50% 0%, ${aura.accent}22, transparent 70%)`,
              }}
            >
              <div
                aria-hidden
                className="pointer-events-none absolute -top-16 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full blur-[80px]"
                style={{ background: `${aura.accent}44` }}
              />
              <div className="relative text-5xl">{aura.emoji}</div>
              <h3
                className="relative mt-3 font-display text-3xl font-semibold tracking-tight"
                style={{ color: aura.accent }}
              >
                {aura.name}
              </h3>
              <p className="relative mt-1 text-sm font-medium text-surface-foreground">
                {aura.tagline}
              </p>
              <p className="relative mx-auto mt-3 max-w-sm text-sm text-muted">{aura.blurb}</p>
            </motion.div>
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setAnswers({});
                  setStage({ kind: 'q', i: 0 });
                }}
                className="text-sm text-muted underline-offset-4 transition hover:text-surface-foreground hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Retake
              </button>
              <Button type="button" variant="primary" onClick={finish} disabled={isBusy}>
                {isBusy ? 'Saving…' : 'Continue setup'}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
