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
import {
  useAgentsControllerMatchForTrip,
  type AgentMatchDto,
  type MatchAgentForTripRequestDto,
  type MatchAgentForTripResponseDto,
} from '@app/sdk';
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
    <main className="space-y-6">
      <p>
        <Link href={`/trips/${tripId}`} className="text-sm text-muted hover:underline">
          ← Back to trip
        </Link>
      </p>
      <PremiumGate>
        <Card>
          <CardHeader>
            <CardTitle>✨ Concierge — match a verified agent</CardTitle>
            <CardSubtitle>
              We hand-pick top-rated, verified agents for your destination. Tell us the region for a
              tighter match (or leave it blank for global top-rated agents).
            </CardSubtitle>
          </CardHeader>
          <form onSubmit={submit} className="space-y-3">
            <Field label="Region (optional)">
              <input
                type="text"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="e.g. France, Bali, Tuscany"
                maxLength={80}
                className="w-full rounded-md border border-muted/30 bg-transparent px-3 py-2 text-sm"
              />
            </Field>
            {errorMsg ? (
              <p className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
                {errorMsg}
              </p>
            ) : null}
            <Button type="submit" variant="primary" disabled={matchMutation.isPending}>
              {matchMutation.isPending ? 'Matching…' : 'Find concierge'}
            </Button>
          </form>
        </Card>
        {matches !== null ? (
          <Card>
            <CardHeader>
              <CardTitle>Top matches</CardTitle>
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
                    className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">
                          ✨ {m.displayName}
                          <span className="ml-2 inline-flex items-center gap-0.5 text-xs font-normal text-amber-700 dark:text-amber-300">
                            ⭐ {m.ratingAverage.toFixed(1)} ({m.ratingCount})
                          </span>
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
                      <button
                        type="button"
                        onClick={() => {
                          // Placeholder — booking flow lands in a future
                          // slice. For now we surface a friendly message
                          // so the affordance works end-to-end.
                          // eslint-disable-next-line no-alert
                          window.alert(
                            `Booking with ${m.displayName} is coming soon. We will reach out when concierge bookings are live.`,
                          );
                        }}
                        className="inline-flex items-center gap-1 rounded-md bg-linear-to-br from-amber-500 to-amber-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:opacity-90"
                      >
                        Book with concierge
                      </button>
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
