/**
 * 3-step onboarding wizard. First-sign-in experience for V.UX.3.
 *
 * Flow:
 *   - StepWhere: pick a destination preset.
 *   - StepWhen: pick a date preset (this weekend / next week / custom).
 *   - StepGenerate: confirm + create the trip + fire AI plan + flip
 *     hasSeenOnboarding + redirect to /trips/[id].
 *
 * Skip terminal (available on every step): POST
 * /auth/onboarding/complete with `{seedSample: true}` so /trips lands
 * with a Sample trip pre-seeded.
 *
 * Re-trigger via `?tour=true` — bypasses the post-login bounce check
 * so an already-onboarded user can re-walk the flow.
 *
 * Auth: protected. If silent-refresh hasn't completed yet we wait;
 * if there's no token after boot, bounce to /login.
 *
 * Installed by prompt [V.UX.3].
 */
'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  useAuthControllerOnboardingComplete,
  useTripControllerCreate,
  useTripControllerPlanWithAi,
  apiFetch,
  type OnboardingCompleteRequestDto,
  type CreateTripRequestDto,
  type TripDto,
} from '@app/sdk';
import { CITY_PRESETS, StepWhere, type CityPreset } from '../../components/onboarding/step-where';
import { StepWhen, type WhenValue } from '../../components/onboarding/step-when';
import { StepGenerate } from '../../components/onboarding/step-generate';
import { TravelAuraQuiz } from '../../components/onboarding/travel-aura-quiz';
import { CalibratingScreen } from '../../components/onboarding/calibrating-screen';
import { saveAuraDraft, type AuraDraft } from '../../lib/travel-aura';
import { useAuthBootComplete, useAuthToken } from '../../lib/use-auth-token';

interface ApiError extends Error {
  readonly code?: string;
  readonly status?: number;
}

function defaultWhen(): WhenValue {
  // "This weekend" preset's effect runs on first render — initialise
  // with empty strings; the StepWhen useEffect will populate them.
  return { preset: 'this-weekend', startsOn: '', endsOn: '' };
}

export default function OnboardingPage() {
  const router = useRouter();
  const token = useAuthToken();
  const bootComplete = useAuthBootComplete();

  // New users meet the traveller quiz first ("answer MCQs to identify
  // what type of traveller they are"), then the trip wizard. Skipping
  // the quiz drops straight into the wizard.
  const [phase, setPhase] = useState<'aura' | 'trip' | 'calibrating'>('aura');
  // Where to go once the "calibrating" screen finishes. A thunk (not a
  // string) so the typed-route literal is preserved without a cast.
  const navRef = useRef<() => void>(() => router.push('/trips'));
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [cityIdx, setCityIdx] = useState(0);
  const [when, setWhen] = useState<WhenValue>(defaultWhen());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (bootComplete && token === null) router.replace('/login');
  }, [bootComplete, token, router]);

  const completeMutation = useAuthControllerOnboardingComplete();
  const createTripMutation = useTripControllerCreate();
  const planMutation = useTripControllerPlanWithAi();

  /**
   * Skip terminal: flag flips + a Sample trip is seeded server-side
   * if this is the user's first /trips fetch.
   */
  async function onSkip() {
    setErrorMsg(null);
    try {
      const data: OnboardingCompleteRequestDto = { seedSample: true };
      await completeMutation.mutateAsync({ data });
      navRef.current = () => router.push('/trips');
      setPhase('calibrating');
    } catch (err) {
      const e = err as ApiError;
      setErrorMsg(`${e.code ?? `HTTP_${e.status ?? '???'}`} — ${e.message ?? 'Skip failed.'}`);
    }
  }

  /**
   * Generate terminal: create the real trip, fire-and-forget the AI
   * plan, mark onboarding complete (no seed — user has a real trip),
   * land on /trips/[id]. AI plan failures don't block the redirect —
   * the trip detail page can re-run the prompt later.
   */
  async function onGenerate() {
    setErrorMsg(null);
    const city: CityPreset = CITY_PRESETS[cityIdx]!;
    const data: CreateTripRequestDto = {
      title: `${city.title} — first trip`,
      center: {
        lat: city.center.lat,
        lng: city.center.lng,
      } as unknown as CreateTripRequestDto['center'],
      radiusKm: 25,
      startsOn: when.startsOn ? `${when.startsOn}T00:00:00.000Z` : undefined,
      endsOn: when.endsOn ? `${when.endsOn}T00:00:00.000Z` : undefined,
    };
    try {
      const created = await createTripMutation.mutateAsync({ data });
      const trip = (created as { data?: unknown }).data as TripDto | undefined;
      if (!trip?.id) throw new Error('Trip created but id missing in response');

      // Fire-and-forget the AI plan. The trip detail page surfaces the
      // result on its own; we don't block the wizard on a slow LLM.
      planMutation.mutate({ id: trip.id });

      // Mark onboarding complete WITHOUT seeding (user has a real trip).
      await completeMutation.mutateAsync({ data: {} });

      navRef.current = () => router.push(`/trips/${trip.id}`);
      setPhase('calibrating');
    } catch (err) {
      const e = err as ApiError;
      setErrorMsg(
        `${e.code ?? `HTTP_${e.status ?? '???'}`} — ${e.message ?? 'Generation failed.'}`,
      );
    }
  }

  if (!bootComplete) {
    return (
      <main>
        <p className="text-muted">Restoring your session…</p>
      </main>
    );
  }
  if (token === null) {
    return (
      <main>
        <p className="text-muted">Redirecting to sign in…</p>
      </main>
    );
  }

  // P1.2: traveller-type quiz first. The result + home + interests are
  // kept in a localStorage draft for now; P1.3 persists it server-side
  // and feeds it into personalization + the "calibrating" screen.
  function onAuraComplete(draft: AuraDraft) {
    // localStorage is the offline-safe bridge; also persist server-side
    // so personalization + the calibrating screen can read it. Direct
    // apiFetch (PATCH /account/preferences) — the field is additive so
    // no SDK regen. Fire-and-forget: a failure must not block setup.
    saveAuraDraft(draft);
    void apiFetch('/api/v1/account/preferences', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        travelAura: draft.aura,
        homeLabel: draft.home?.label ?? null,
        homeLat: draft.home?.lat ?? null,
        homeLng: draft.home?.lng ?? null,
        travelInterests: [...draft.interests],
      }),
    }).catch(() => {
      /* offline / transient — the localStorage draft still carries it */
    });
    setPhase('trip');
  }

  if (phase === 'aura') {
    return (
      <main className="mx-auto max-w-2xl space-y-8 py-4">
        <TravelAuraQuiz onComplete={onAuraComplete} onSkip={() => setPhase('trip')} />
      </main>
    );
  }

  // P1.4: after setup completes, a brief premium "calibrating" beat
  // (reads the just-derived Aura) then the stored navigation runs.
  if (phase === 'calibrating') {
    return <CalibratingScreen onDone={() => navRef.current()} />;
  }

  return (
    <main className="mx-auto max-w-2xl space-y-8 py-4">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand">Welcome aboard</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Let's plan your first trip
        </h1>
        <p className="text-sm text-muted">
          Three quick questions, ~30 seconds. You can skip anytime.
        </p>
      </header>

      {/* Progress dots */}
      <ol className="flex items-center gap-2" aria-label="Wizard progress">
        {[0, 1, 2].map((i) => (
          <li
            key={i}
            className={`h-1.5 flex-1 rounded-full transition ${
              i <= step ? 'bg-brand' : 'bg-muted/20'
            }`}
            aria-current={i === step ? 'step' : undefined}
          />
        ))}
      </ol>

      {step === 0 ? (
        <StepWhere
          value={cityIdx}
          onChange={setCityIdx}
          onNext={() => setStep(1)}
          onSkip={onSkip}
          isSkipping={completeMutation.isPending}
        />
      ) : null}

      {step === 1 ? (
        <StepWhen
          value={when}
          onChange={setWhen}
          onBack={() => setStep(0)}
          onNext={() => setStep(2)}
          onSkip={onSkip}
          isSkipping={completeMutation.isPending}
        />
      ) : null}

      {step === 2 ? (
        <StepGenerate
          city={CITY_PRESETS[cityIdx]!}
          when={when}
          onBack={() => setStep(1)}
          onGenerate={onGenerate}
          onSkip={onSkip}
          isGenerating={createTripMutation.isPending || completeMutation.isPending}
          isSkipping={completeMutation.isPending && !createTripMutation.isPending}
          errorMsg={errorMsg}
        />
      ) : null}
    </main>
  );
}
