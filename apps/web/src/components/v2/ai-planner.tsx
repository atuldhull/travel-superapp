/**
 * v2 AI Trip Planner — the live, functional centrepiece.
 *
 * A modal that calls the REAL public `/trips/sample-plan` endpoint via
 * `useTripControllerSamplePlan` (no auth, no signup wall) and renders
 * the AI-written prose itinerary inline, with the model/provider it ran
 * on. Seeded with whatever destination the hero search / "Plan My Trip"
 * button passed in.
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Loader2, Sparkles, X } from 'lucide-react';
import { useTripControllerSamplePlan, type GenerateSamplePlanResponseDto } from '@app/sdk';
import { GOLD_TEXT } from './kit';

interface Preset {
  readonly title: string;
  readonly center: { readonly lat: number; readonly lng: number };
}

/** Coords so the AI port + any map viz have a real centre to anchor on. */
const PRESETS: readonly Preset[] = [
  { title: 'Santorini', center: { lat: 36.3932, lng: 25.4615 } },
  { title: 'Kyoto', center: { lat: 35.0116, lng: 135.7681 } },
  { title: 'Maldives', center: { lat: 3.2028, lng: 73.2207 } },
  { title: 'Bali', center: { lat: -8.3405, lng: 115.092 } },
  { title: 'Swiss Alps', center: { lat: 46.0207, lng: 7.7491 } },
  { title: 'Jaipur', center: { lat: 26.9124, lng: 75.7873 } },
];
const DEFAULT_CENTER = { lat: 20, lng: 0 } as const;

function centerFor(title: string): { lat: number; lng: number } {
  const hit = PRESETS.find((p) => p.title.toLowerCase() === title.trim().toLowerCase());
  return hit ? hit.center : DEFAULT_CENTER;
}

export interface PlanModalProps {
  readonly open: boolean;
  readonly initialDestination: string;
  readonly onClose: () => void;
}

export function PlanModal({
  open,
  initialDestination,
  onClose,
}: PlanModalProps): React.ReactElement | null {
  const [title, setTitle] = useState(initialDestination || 'Santorini');
  const inputRef = useRef<HTMLInputElement>(null);
  const mutation = useTripControllerSamplePlan();
  const plan = mutation.data?.data as unknown as GenerateSamplePlanResponseDto | undefined;

  useEffect(() => {
    if (open && initialDestination) setTitle(initialDestination);
  }, [open, initialDestination]);

  // Move focus into the dialog when it opens (a11y).
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const generate = (): void => {
    const t = title.trim() || 'Santorini';
    mutation.mutate({ data: { title: t, center: centerFor(t), radiusKm: 25 } });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="AI trip planner"
      className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
    >
      <button
        type="button"
        aria-label="Close planner"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <div className="relative z-10 flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl border border-gold-600/25 bg-surface shadow-(--shadow-depth-3) sm:rounded-3xl">
        {/* Header — dark royal band */}
        <div
          className="relative shrink-0 px-6 py-5"
          style={{ backgroundImage: 'var(--gradient-royal)' }}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-4 top-4 rounded-full p-1.5 text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-gold-300">
            <Sparkles className="h-3.5 w-3.5" aria-hidden /> AI Trip Planner
          </p>
          <h3 className="mt-2 font-display text-2xl font-semibold text-white">
            Your dream journey, <span style={GOLD_TEXT}>crafted by AI</span>
          </h3>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <label htmlFor="plan-dest" className="text-sm font-medium text-surface-foreground">
            Where do you want to go?
          </label>
          <div className="mt-2 flex flex-col gap-2.5 sm:flex-row">
            <input
              id="plan-dest"
              ref={inputRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') generate();
              }}
              placeholder="e.g. Kyoto, Bali, Santorini…"
              className="w-full rounded-xl border border-gold-600/25 bg-surface px-4 py-3 text-sm text-surface-foreground outline-none transition focus:border-gold-500 focus:ring-2 focus:ring-gold-500/30"
            />
            <button
              type="button"
              onClick={generate}
              disabled={mutation.isPending}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-brand-900 shadow-(--shadow-glow) transition hover:-translate-y-0.5 disabled:opacity-60"
              style={{ backgroundImage: 'var(--gradient-gold)' }}
            >
              {mutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Sparkles className="h-4 w-4" aria-hidden />
              )}
              {mutation.isPending ? 'Crafting…' : 'Plan it'}
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.title}
                type="button"
                onClick={() => setTitle(p.title)}
                className="rounded-full border border-gold-600/20 px-3 py-1 text-xs font-medium text-muted transition hover:border-gold-500/50 hover:text-surface-foreground"
              >
                {p.title}
              </button>
            ))}
          </div>

          {/* Result */}
          <div className="mt-5">
            {mutation.isPending ? (
              <div className="space-y-2.5" aria-live="polite">
                <div className="shimmer h-4 w-3/4 rounded" />
                <div className="shimmer h-4 w-full rounded" />
                <div className="shimmer h-4 w-5/6 rounded" />
                <div className="shimmer h-4 w-2/3 rounded" />
              </div>
            ) : mutation.isError ? (
              <p className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
                Couldn&apos;t reach the planner just now. Please try again.
              </p>
            ) : plan ? (
              <div>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-gold-500/12 px-2.5 py-1 text-xs font-semibold text-gold-700 ring-1 ring-gold-500/30 dark:text-gold-300">
                    <Sparkles className="h-3 w-3" aria-hidden /> {plan.provider} · {plan.model}
                  </span>
                </div>
                <article className="whitespace-pre-wrap text-sm leading-relaxed text-surface-foreground/90">
                  {plan.plan}
                </article>
                <Link
                  href={'/register' as never}
                  className="mt-5 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-brand-900 shadow-(--shadow-glow) transition hover:-translate-y-0.5"
                  style={{ backgroundImage: 'var(--gradient-gold)' }}
                >
                  Save &amp; build this trip
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>
            ) : (
              <p className="text-sm leading-relaxed text-muted">
                Pick a place and we&apos;ll sketch a full day-by-day itinerary in seconds — no
                signup needed.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
