/**
 * Onboarding step 3 — Generate.
 *
 * The Generate button:
 *   1. POST /trips                         (create the real trip)
 *   2. POST /trips/:id/plan-with-ai        (kick the AI; failure-tolerant)
 *   3. POST /auth/onboarding/complete      ({} — flag flips, no seed)
 *   4. router.push('/trips/[id]')
 *
 * Step 3 is the only place where mutations happen — keeps the wizard
 * navigable up to this point with no DB side effects. The Skip button
 * here mirrors steps 1+2: posts seedSample=true and lands on /trips.
 *
 * Confetti on the trip's detail page is V.UX.3-future; we keep this
 * step focused on the single trip-create round trip.
 *
 * Installed by prompt [V.UX.3].
 */
'use client';

import { Button } from '../ui/button';
import { Card, CardHeader, CardSubtitle, CardTitle } from '../ui/card';
import type { CityPreset } from './step-where';
import type { WhenValue } from './step-when';

interface StepGenerateProps {
  readonly city: CityPreset;
  readonly when: WhenValue;
  readonly onBack: () => void;
  readonly onGenerate: () => void;
  readonly onSkip: () => void;
  readonly isGenerating: boolean;
  readonly isSkipping: boolean;
  readonly errorMsg: string | null;
}

export function StepGenerate({
  city,
  when,
  onBack,
  onGenerate,
  onSkip,
  isGenerating,
  isSkipping,
  errorMsg,
}: StepGenerateProps) {
  return (
    <section className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-brand">Step 3 of 3</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Ready to generate?</h2>
        <p className="mt-1 text-sm text-muted">
          We'll create your trip and ask the AI for a 3-day plan. Takes ~5 seconds.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>
            <span aria-hidden className="mr-2">
              {city.emoji}
            </span>
            {city.title}
          </CardTitle>
          <CardSubtitle>
            🗓 {when.startsOn} → {when.endsOn} · 25 km radius
          </CardSubtitle>
        </CardHeader>
        <p className="text-sm text-muted">
          Once created, your trip lives in <strong>Your trips</strong>. You can rename, share with
          collaborators, vote on items, and keep adding more days.
        </p>
      </Card>

      {errorMsg ? (
        <p className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          {errorMsg}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <Button
          type="button"
          variant="ghost"
          onClick={onBack}
          disabled={isGenerating || isSkipping}
        >
          ← Back
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onSkip}
            disabled={isGenerating || isSkipping}
          >
            {isSkipping ? 'Skipping…' : 'Skip for now'}
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={onGenerate}
            disabled={isGenerating || isSkipping}
          >
            {isGenerating ? '✨ Generating…' : `✨ Generate my ${city.title} trip`}
          </Button>
        </div>
      </div>
    </section>
  );
}
