/**
 * Onboarding step 1 — Where are you going?
 *
 * Same 6 city presets as the landing-page SampleTripDemo so a
 * returning visitor sees a familiar grid. Custom city is
 * intentionally out of scope for this slice — geocoding lands in
 * V.UX.18.
 *
 * Installed by prompt [V.UX.3].
 */
'use client';

import { Button } from '../ui/button';

export interface CityPreset {
  readonly title: string;
  readonly emoji: string;
  readonly center: { readonly lat: number; readonly lng: number };
}

export const CITY_PRESETS: readonly CityPreset[] = [
  { title: 'Goa', emoji: '🏖', center: { lat: 15.2993, lng: 74.124 } },
  { title: 'Rishikesh', emoji: '🧘', center: { lat: 30.0869, lng: 78.2676 } },
  { title: 'Tokyo', emoji: '🗼', center: { lat: 35.6762, lng: 139.6503 } },
  { title: 'Bali', emoji: '🌴', center: { lat: -8.3405, lng: 115.092 } },
  { title: 'Lisbon', emoji: '🚋', center: { lat: 38.7223, lng: -9.1393 } },
  { title: 'Mexico City', emoji: '🌮', center: { lat: 19.4326, lng: -99.1332 } },
];

interface StepWhereProps {
  readonly value: number; // index into CITY_PRESETS
  readonly onChange: (idx: number) => void;
  readonly onNext: () => void;
  readonly onSkip: () => void;
  readonly isSkipping: boolean;
}

export function StepWhere({ value, onChange, onNext, onSkip, isSkipping }: StepWhereProps) {
  return (
    <section className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-brand">Step 1 of 3</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Where are you going?</h2>
        <p className="mt-1 text-sm text-muted">
          Pick a destination to plan your first trip. You can edit later.
        </p>
      </header>
      <ul
        className="grid grid-cols-2 gap-3 sm:grid-cols-3"
        role="radiogroup"
        aria-label="Destination"
      >
        {CITY_PRESETS.map((c, i) => {
          const active = i === value;
          return (
            <li key={c.title}>
              <button
                type="button"
                onClick={() => onChange(i)}
                aria-pressed={active}
                className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${
                  active
                    ? 'border-brand bg-brand/10 shadow-sm'
                    : 'border-muted/20 hover:border-brand/30 hover:bg-muted/5'
                }`}
              >
                <span aria-hidden className="text-2xl">
                  {c.emoji}
                </span>
                <span className="font-medium">{c.title}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <Button
          type="button"
          variant="ghost"
          onClick={onSkip}
          disabled={isSkipping}
          aria-label="Skip onboarding and go to your trips"
        >
          {isSkipping ? 'Skipping…' : 'Skip for now'}
        </Button>
        <Button type="button" variant="primary" onClick={onNext}>
          Next: when?
        </Button>
      </div>
    </section>
  );
}
