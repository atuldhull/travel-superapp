/**
 * V.UX.17 — `/trips/:id/concierge`. Premium-only agent-match flow.
 *
 *   - <PremiumGate> wraps the form so non-premium callers see the
 *     upgrade CTA (mirrors the api's `@Roles('premium','admin')`
 *     guard, which would 403 anyway — UX-side gate avoids the
 *     round-trip).
 *   - Region input is free-form; submitting POSTs the api with the
 *     trimmed value. Empty input falls through to "match top-rated
 *     verified agents globally", which is what the persona's "first
 *     contact" use-case needs.
 *
 * Installed by prompt [V.UX.17].
 */
'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { ArrowLeft, Sparkles, Star } from 'lucide-react';
import {
  useAgentsControllerMatchForTrip,
  type AgentMatchDto,
  type MatchAgentForTripRequestDto,
  type MatchAgentForTripResponseDto,
} from '@app/sdk';
import { Badge } from '../../../../components/ui/badge';
import { Button } from '../../../../components/ui/button';
import { Card, CardHeader, CardSubtitle, CardTitle } from '../../../../components/ui/card';
import { Field } from '../../../../components/ui/input';
import { PremiumGate } from '../../../../components/upsell/premium-gate';
import { useAuthBootComplete, useAuthToken } from '../../../../lib/use-auth-token';

interface ApiError extends Error {
  readonly code?: string;
  readonly status?: number;
}

export default function ConciergePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const tripId = params?.id ?? '';
  const token = useAuthToken();
  const bootComplete = useAuthBootComplete();

  const [region, setRegion] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [matches, setMatches] = useState<readonly AgentMatchDto[] | null>(null);

  useEffect(() => {
    if (bootComplete && token === null) router.replace('/login');
  }, [bootComplete, token, router]);

  const matchMutation = useAgentsControllerMatchForTrip({
    mutation: {
      onSuccess: (response: { data?: unknown }) => {
        const body = response.data as MatchAgentForTripResponseDto | undefined;
        setMatches(body?.matches ?? []);
        setErrorMsg(null);
      },
      onError: (err: unknown) => {
        const e = err as ApiError;
        setErrorMsg(`${e.code ?? `HTTP_${e.status ?? '???'}`} — ${e.message ?? 'Match failed.'}`);
        setMatches(null);
      },
    },
  });

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMsg(null);
    const trimmed = region.trim();
    const data: MatchAgentForTripRequestDto = {
      tripId,
      ...(trimmed.length > 0 ? { region: trimmed } : {}),
    };
    matchMutation.mutate({ data });
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

  return (
    <main className="space-y-8">
      <Link
        href={`/trips/${tripId}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted underline-offset-4 transition hover:text-gold-600 hover:underline"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" /> Back to trip
      </Link>

      {/* Cinematic royal header band — matches /trips + /stays. */}
      <header
        className="relative isolate overflow-hidden rounded-3xl border border-gold-600/20 px-6 py-8 shadow-(--shadow-depth-2) sm:px-10"
        style={{ backgroundImage: 'var(--gradient-royal)' }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-gold-500/20 blur-[110px]"
        />
        <p className="relative inline-flex items-center gap-2 rounded-full border border-gold-500/40 bg-white/5 px-3 py-1 text-xs font-medium tracking-wide text-gold-300 backdrop-blur-sm">
          <Sparkles aria-hidden className="h-3.5 w-3.5" /> Premium concierge
        </p>
        <h1 className="relative mt-3 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          Match a verified agent
        </h1>
        <p className="relative mt-2 max-w-lg text-sm text-white/65">
          We hand-pick top-rated, verified local agents for your destination — booked, briefed, and
          ready before you land.
        </p>
      </header>

      <PremiumGate>
        <Card depth="raised">
          <CardHeader>
            <CardTitle className="font-display text-xl">Find your concierge</CardTitle>
            <CardSubtitle>
              Tell us the region for a tighter match (or leave it blank for global top-rated
              agents).
            </CardSubtitle>
          </CardHeader>
          <form onSubmit={submit} className="space-y-3">
            <Field
              label="Region (optional)"
              type="text"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="e.g. France, Bali, Tuscany"
              maxLength={80}
            />
            {errorMsg ? (
              <p className="rounded-2xl border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
                {errorMsg}
              </p>
            ) : null}
            <Button type="submit" variant="royal" disabled={matchMutation.isPending}>
              <Sparkles aria-hidden className="mr-1.5 h-4 w-4" />
              {matchMutation.isPending ? 'Matching…' : 'Find concierge'}
            </Button>
          </form>
        </Card>
        {matches !== null ? (
          <Card depth="raised">
            <CardHeader>
              <CardTitle className="font-display text-xl">Top matches</CardTitle>
              <CardSubtitle>
                {matches.length === 0
                  ? 'No verified agents matched yet — we expand the network as we go.'
                  : `${matches.length} verified agent${matches.length === 1 ? '' : 's'}, ranked by rating.`}
              </CardSubtitle>
            </CardHeader>
            {matches.length > 0 ? (
              <ul className="space-y-3">
                {matches.map((m) => (
                  <li
                    key={m.id}
                    className="rounded-2xl border border-gold-600/12 bg-surface p-4 shadow-(--shadow-depth-1) transition hover:border-gold-600/25 hover:shadow-(--shadow-depth-2)"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <p className="flex flex-wrap items-center gap-2">
                          <span className="font-display text-base font-semibold tracking-tight text-surface-foreground">
                            {m.displayName}
                          </span>
                          <Badge variant="gold">
                            <Star aria-hidden className="mr-1 h-3 w-3 fill-current" />
                            {m.ratingAverage.toFixed(1)} ({m.ratingCount})
                          </Badge>
                        </p>
                        {(() => {
                          const bio = (m.bio as unknown as string | null) ?? null;
                          return bio !== null ? (
                            <p className="mt-1 text-xs text-muted">{bio}</p>
                          ) : null;
                        })()}
                        <p className="mt-1 text-[11px] text-muted">
                          Languages: {m.languages.length > 0 ? m.languages.join(', ') : '—'} ·
                          Regions: {m.regions.length > 0 ? m.regions.join(', ') : '—'}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="royal"
                        size="sm"
                        disabled
                        title="Concierge bookings open soon — this agent's profile is real; the booking flow lands in a later slice."
                      >
                        Booking soon
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>
        ) : null}
      </PremiumGate>
    </main>
  );
}
