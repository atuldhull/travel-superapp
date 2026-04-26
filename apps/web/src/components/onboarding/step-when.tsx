/**
 * Onboarding step 2 — When?
 *
 * Three preset chips ("This weekend", "Next week", "Custom") + an
 * inline date pair when Custom is selected. Defaults to "This
 * weekend" so the user can advance with one click.
 *
 * Installed by prompt [V.UX.3].
 */
'use client';

import { useEffect } from 'react';
import { Button } from '../ui/button';
import { Field } from '../ui/input';

export type WhenPreset = 'this-weekend' | 'next-week' | 'custom';

export interface WhenValue {
  readonly preset: WhenPreset;
  readonly startsOn: string; // YYYY-MM-DD
  readonly endsOn: string;
}

function fmt(d: Date): string {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function nextWeekend(): { startsOn: string; endsOn: string } {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun .. 6=Sat
  const daysToSat = (6 - day + 7) % 7 || 7;
  const sat = new Date(now);
  sat.setUTCDate(now.getUTCDate() + daysToSat);
  const sun = new Date(sat);
  sun.setUTCDate(sat.getUTCDate() + 1);
  return { startsOn: fmt(sat), endsOn: fmt(sun) };
}

function nextWeek(): { startsOn: string; endsOn: string } {
  const now = new Date();
  const day = now.getUTCDay();
  const daysToMon = (1 - day + 7) % 7 || 7;
  const mon = new Date(now);
  mon.setUTCDate(now.getUTCDate() + daysToMon);
  const fri = new Date(mon);
  fri.setUTCDate(mon.getUTCDate() + 4);
  return { startsOn: fmt(mon), endsOn: fmt(fri) };
}

interface StepWhenProps {
  readonly value: WhenValue;
  readonly onChange: (next: WhenValue) => void;
  readonly onBack: () => void;
  readonly onNext: () => void;
  readonly onSkip: () => void;
  readonly isSkipping: boolean;
}

export function StepWhen({ value, onChange, onBack, onNext, onSkip, isSkipping }: StepWhenProps) {
  // When the preset changes, reset the dates accordingly.
  useEffect(() => {
    if (value.preset === 'this-weekend') {
      const dates = nextWeekend();
      if (value.startsOn !== dates.startsOn || value.endsOn !== dates.endsOn) {
        onChange({ preset: 'this-weekend', ...dates });
      }
    } else if (value.preset === 'next-week') {
      const dates = nextWeek();
      if (value.startsOn !== dates.startsOn || value.endsOn !== dates.endsOn) {
        onChange({ preset: 'next-week', ...dates });
      }
    }
    // Custom: leave dates alone — user controls them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.preset]);

  return (
    <section className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-brand">Step 2 of 3</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">When?</h2>
        <p className="mt-1 text-sm text-muted">Pick a preset or set your own dates.</p>
      </header>

      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="When">
        {(
          [
            { id: 'this-weekend', label: 'This weekend', emoji: '🎒' },
            { id: 'next-week', label: 'Next week', emoji: '📅' },
            { id: 'custom', label: 'Custom dates', emoji: '✏️' },
          ] as const
        ).map((p) => {
          const active = p.id === value.preset;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onChange({ ...value, preset: p.id })}
              aria-pressed={active}
              className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm transition ${
                active
                  ? 'border-brand bg-brand text-brand-foreground'
                  : 'border-muted/30 text-muted hover:bg-muted/10'
              }`}
            >
              <span aria-hidden>{p.emoji}</span> {p.label}
            </button>
          );
        })}
      </div>

      {value.preset === 'custom' ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Starts on"
            type="date"
            value={value.startsOn}
            onChange={(e) => onChange({ ...value, startsOn: e.target.value })}
          />
          <Field
            label="Ends on"
            type="date"
            value={value.endsOn}
            min={value.startsOn}
            onChange={(e) => onChange({ ...value, endsOn: e.target.value })}
          />
        </div>
      ) : (
        <p className="rounded-md border border-muted/20 bg-muted/5 px-4 py-3 text-sm text-muted">
          <span aria-hidden className="mr-1.5">
            🗓
          </span>
          {value.startsOn} → {value.endsOn}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <Button type="button" variant="ghost" onClick={onBack}>
          ← Back
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="ghost" onClick={onSkip} disabled={isSkipping}>
            {isSkipping ? 'Skipping…' : 'Skip for now'}
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={onNext}
            disabled={!value.startsOn || !value.endsOn || value.startsOn > value.endsOn}
          >
            Next: generate
          </Button>
        </div>
      </div>
    </section>
  );
}
