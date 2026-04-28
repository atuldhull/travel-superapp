/**
 * V.UX.18 — pre-trip primer for the international first-timer.
 * Caller types/picks a country code; the page renders the seeded
 * editorial primer (visa info, top scams, emergency numbers,
 * survival phrases). Six countries seeded in v1 (TH/JP/IN/FR/MX/US);
 * unknown codes surface a friendly "no primer yet" panel.
 *
 * Auth-gated like the rest of the trip detail surfaces.
 *
 * Installed by prompt [V.UX.18].
 */
'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import {
  useCountryPrimerControllerGet,
  type CountryPrimerDto,
  type EmergencyNumberDto,
  type LanguagePhraseDto,
} from '@app/sdk';
import { Card, CardHeader, CardSubtitle, CardTitle } from '../../../../components/ui/card';
import { Field } from '../../../../components/ui/input';
import { Skeleton } from '../../../../components/ui/skeleton';
import { useAuthBootComplete, useAuthToken } from '../../../../lib/use-auth-token';

interface ApiError extends Error {
  readonly code?: string;
  readonly status?: number;
}

const SEEDED_COUNTRIES: readonly { code: string; label: string }[] = [
  { code: 'th', label: '🇹🇭 Thailand' },
  { code: 'jp', label: '🇯🇵 Japan' },
  { code: 'in', label: '🇮🇳 India' },
  { code: 'fr', label: '🇫🇷 France' },
  { code: 'mx', label: '🇲🇽 Mexico' },
  { code: 'us', label: '🇺🇸 United States' },
];

export default function TripPrimerPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const tripId = params?.id ?? '';
  const token = useAuthToken();
  const bootComplete = useAuthBootComplete();

  const [country, setCountry] = useState('th');

  useEffect(() => {
    if (bootComplete && token === null) router.replace('/login');
  }, [bootComplete, token, router]);

  const { data, isLoading, isError, error } = useCountryPrimerControllerGet(country, {
    query: { enabled: token !== null && country !== '', retry: false },
  });

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

  const primer = data?.data as unknown as CountryPrimerDto | undefined;
  const apiErr = error as ApiError | null;
  const missing = apiErr?.status === 404;

  return (
    <main className="space-y-6">
      <p>
        <Link href={`/trips/${tripId}`} className="text-sm text-muted hover:underline">
          ← Back to trip
        </Link>
      </p>
      <Card>
        <CardHeader>
          <CardTitle>🌐 Pre-trip primer</CardTitle>
          <CardSubtitle>
            Visa, scams, emergency numbers, and survival phrases for your destination. Editorial
            seed — six countries today, more landing later.
          </CardSubtitle>
        </CardHeader>
        <Field label="Destination">
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="w-full rounded-md border border-muted/30 bg-transparent px-3 py-2 text-sm"
          >
            {SEEDED_COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
      </Card>
      {isLoading ? (
        <Card>
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="mt-2 h-4 w-3/4" />
          <Skeleton className="mt-2 h-4 w-1/3" />
        </Card>
      ) : isError ? (
        <Card>
          <p className="text-sm text-danger">
            {missing
              ? `No primer for "${country}" yet — we expand the editorial seed as we go.`
              : `Couldn't load primer (${apiErr?.code ?? `HTTP_${apiErr?.status ?? '???'}`}).`}
          </p>
        </Card>
      ) : primer ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>🛂 Visa</CardTitle>
              <CardSubtitle>Going to {primer.countryName}</CardSubtitle>
            </CardHeader>
            <p className="text-sm leading-relaxed">{primer.visaInfo}</p>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>⚠️ Common scams</CardTitle>
              <CardSubtitle>What other travelers have flagged.</CardSubtitle>
            </CardHeader>
            <ul className="flex flex-wrap gap-2">
              {primer.topScamCategories.map((cat) => (
                <li
                  key={cat}
                  className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs text-amber-700 dark:text-amber-300"
                >
                  {cat.replace(/-/g, ' ')}
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>🚨 Emergency numbers</CardTitle>
              <CardSubtitle>Save these to your phone before you land.</CardSubtitle>
            </CardHeader>
            <ul className="space-y-1 text-sm">
              {primer.emergencyNumbers.map((e: EmergencyNumberDto) => (
                <li key={`${e.label}:${e.number}`} className="flex justify-between gap-3">
                  <span>{e.label}</span>
                  <a href={`tel:${e.number}`} className="font-mono text-brand hover:underline">
                    {e.number}
                  </a>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>🗣️ Survival phrases</CardTitle>
              <CardSubtitle>Tap a phrase to copy it.</CardSubtitle>
            </CardHeader>
            <ul className="space-y-2 text-sm">
              {primer.languagePhrases.map((p: LanguagePhraseDto) => (
                <li
                  key={`${p.english}:${p.translation}`}
                  className="rounded-md border border-muted/15 bg-muted/5 p-2"
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
                        navigator.clipboard.writeText(p.translation).catch(() => {
                          // ignore — user can long-press
                        });
                      }
                    }}
                    className="block w-full text-left"
                  >
                    <p className="font-medium">{p.translation}</p>
                    <p className="text-xs text-muted">{p.english}</p>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
          <p className="text-[11px] text-muted">
            Editorial seed last refreshed {new Date(primer.seededAt).toLocaleDateString()}.
          </p>
        </>
      ) : null}
    </main>
  );
}
