/**
 * v2 AI-planner CTA band — the `#plan` anchor target. A cinematic dark
 * royal panel that re-invites planning mid-page and opens the live
 * <PlanModal>. Client component (modal open state).
 */
'use client';

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { PlanModal } from './ai-planner';
import { Eyebrow, GOLD_TEXT } from './kit';

export function V2PlanCta(): React.ReactElement {
  const [open, setOpen] = useState(false);

  return (
    <div id="plan" className="mx-auto w-full max-w-7xl px-6 py-16 sm:py-20">
      <div
        className="relative isolate overflow-hidden rounded-[2rem] border border-gold-600/20 px-8 py-16 text-center shadow-(--shadow-depth-3) sm:px-12"
        style={{ backgroundImage: 'var(--gradient-royal)' }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-gold-500/25 blur-[120px]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -left-20 h-72 w-72 rounded-full bg-brand-400/20 blur-[120px]"
        />
        <div className="relative mx-auto max-w-2xl">
          <Eyebrow className="text-gold-200 dark:text-gold-200">AI Trip Planner</Eyebrow>
          <h2 className="mt-4 font-display text-3xl font-semibold leading-tight text-white sm:text-4xl lg:text-5xl">
            Tell us a place. <span style={GOLD_TEXT}>Get the whole journey.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-white/70">
            A personalised, day-by-day itinerary written for you in seconds — free, no signup
            required.
          </p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mt-7 inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-semibold text-brand-900 shadow-(--shadow-glow) transition hover:-translate-y-0.5"
            style={{ backgroundImage: 'var(--gradient-gold)' }}
          >
            <Sparkles className="h-4 w-4" aria-hidden /> Plan My Trip
          </button>
        </div>
      </div>

      <PlanModal open={open} initialDestination="" onClose={() => setOpen(false)} />
    </div>
  );
}
