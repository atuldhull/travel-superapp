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
import { ArrowLeft, BookOpen, MessageSquare, Phone, ShieldAlert, Stamp } from 'lucide-react';
import {
  useCountryPrimerControllerGet,
  type CountryPrimerDto,
  type EmergencyNumberDto,
  type LanguagePhraseDto,
} from '@app/sdk';
import { Badge } from '../../../../components/ui/badge';
import { Card, CardHeader, CardSubtitle, CardTitle } from '../../../../components/ui/card';
import { Skeleton } from '../../../../components/ui/skeleton';
import { useAuthBootComplete, useAuthToken } from '../../../../lib/use-auth-token';
import {
  loadCountryPrimer,
  saveCountryPrimer,
  type OfflinePrimerSnapshot,
} from '../../../../lib/offline-primer-cache';
import { useOnline } from '../../../../lib/use-online';
import { formatSavedAt } from '../../../../lib/offline-trip-cache';

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

  // I3 (Phase 6) — offline primer cache.
  //
  //  - When the api returns a primer, mirror it into IDB keyed by cc.
  //  - When the country changes, try to load the cached snapshot up
  //    front so we have something to show before the network resolves
  //    (or instead of nothing when offline).
  //  - The cache also feeds the dedicated phrases page (I5).
  const online = useOnline();
  const [snapshot, setSnapshot] = useState<OfflinePrimerSnapshot | null>(null);
  useEffect(() => {
    if (!country) return;
    let alive = true;
    void (async () => {
      const snap = await loadCountryPrimer(country);
      if (alive) setSnapshot(snap);
    })();
    return () => {
      alive = false;
    };
  }, [country]);
  useEffect(() => {
    const liveEnv = data as { data?: unknown } | undefined;
    const livePrimer = liveEnv?.data ?? null;
    if (!livePrimer || !country) return;
    void saveCountryPrimer({ cc: country, primer: livePrimer });
  }, [data, country]);

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

  const livePrimer = data?.data as unknown as CountryPrimerDto | undefined;
  const cachedPrimer = snapshot && snapshot.primer ? (snapshot.primer as CountryPrimerDto) : null;
  // Prefer the live primer; fall back to the cached snapshot when
  // the fetch errors or is still loading (so the page never goes
  // empty offline). A real 404 ("no primer for this cc") wins over
  // a stale cache for a different cc would be a UX bug — but the
  // cache is cc-keyed, so a stale-for-different-cc hit isn't
  // possible. A 404 means the editorial seed truly doesn't have it.
  const primer: CountryPrimerDto | undefined = livePrimer ?? cachedPrimer ?? undefined;
  const apiErr = error as ApiError | null;
  const missing = apiErr?.status === 404 && !cachedPrimer;
  const renderingFromCache = !livePrimer && Boolean(cachedPrimer);

  return (
    <main className="space-y-8">
      <p>
        <Link
          href={`/trips/${tripId}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted underline-offset-4 transition hover:text-gold-600 hover:underline"
        >
          <ArrowLeft aria-hidden className="h-3.5 w-3.5" /> Back to trip
        </Link>
      </p>

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
          <BookOpen aria-hidden className="h-3.5 w-3.5" /> Before you go
        </p>
        <h1 className="relative mt-3 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          Pre-trip primer
        </h1>
        <p className="relative mt-2 max-w-lg text-sm text-white/65">
          Visa, scams, emergency numbers, and survival phrases for your destination. Editorial seed
          — six countries today, more landing later.
        </p>
      </header>

      <Card depth="raised">
        <CardHeader>
          <CardTitle>Destination</CardTitle>
          <CardSubtitle>Pick where you’re headed to load its primer.</CardSubtitle>
        </CardHeader>
        <label htmlFor="primer-country" className="block space-y-1">
          <span className="block text-sm font-medium">Country</span>
          <select
            id="primer-country"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="w-full rounded-lg border border-gold-600/25 bg-surface px-3 py-2 text-sm text-surface-foreground outline-none transition focus:border-gold-500 focus:ring-2 focus:ring-gold-500/25"
          >
            {SEEDED_COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
      </Card>
      {isLoading && !primer ? (
        <Card depth="raised">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="mt-2 h-4 w-3/4" />
          <Skeleton className="mt-2 h-4 w-1/3" />
        </Card>
      ) : isError && !primer ? (
        <Card depth="raised" className="border-danger/30 bg-danger/5">
          <p className="text-sm text-danger">
            {missing
              ? `No primer for "${country}" yet — we expand the editorial seed as we go.`
              : `Couldn't load primer (${apiErr?.code ?? `HTTP_${apiErr?.status ?? '???'}`}).`}
          </p>
        </Card>
      ) : primer ? (
        <>
          {renderingFromCache || !online ? (
            <p
              className="inline-flex items-center gap-1.5 rounded-full border border-gold-600/30 bg-gold-500/10 px-3 py-1 text-xs font-medium text-gold-700 dark:text-gold-300"
              title="The network is unreachable. This is the primer saved on this device the last time it loaded online."
            >
              Offline copy
              {snapshot ? ` · fetched ${formatSavedAt(snapshot.fetchedAt) ?? 'a while ago'}` : null}
            </p>
          ) : null}
          <Card depth="raised">
            <CardHeader>
              <CardTitle className="inline-flex items-center gap-2">
                <Stamp aria-hidden className="h-5 w-5 text-gold-600" /> Visa
              </CardTitle>
              <CardSubtitle>Going to {primer.countryName}</CardSubtitle>
            </CardHeader>
            <p className="text-sm leading-relaxed text-surface-foreground">{primer.visaInfo}</p>
          </Card>
          <Card depth="raised">
            <CardHeader>
              <CardTitle className="inline-flex items-center gap-2">
                <ShieldAlert aria-hidden className="h-5 w-5 text-gold-600" /> Common scams
              </CardTitle>
              <CardSubtitle>What other travelers have flagged.</CardSubtitle>
            </CardHeader>
            <ul className="flex flex-wrap gap-2">
              {primer.topScamCategories.map((cat) => (
                <li key={cat}>
                  <Badge variant="gold">{cat.replace(/-/g, ' ')}</Badge>
                </li>
              ))}
            </ul>
          </Card>
          <Card depth="raised">
            <CardHeader>
              <CardTitle className="inline-flex items-center gap-2">
                <Phone aria-hidden className="h-5 w-5 text-gold-600" /> Emergency numbers
              </CardTitle>
              <CardSubtitle>Save these to your phone before you land.</CardSubtitle>
            </CardHeader>
            <ul className="space-y-2 text-sm">
              {primer.emergencyNumbers.map((e: EmergencyNumberDto) => (
                <li
                  key={`${e.label}:${e.number}`}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-gold-600/12 bg-surface p-4 shadow-(--shadow-depth-1) transition hover:border-gold-600/25"
                >
                  <span className="font-display text-sm font-semibold tracking-tight text-surface-foreground">
                    {e.label}
                  </span>
                  <a
                    href={`tel:${e.number}`}
                    className="font-mono text-gold-700 underline-offset-4 transition hover:underline dark:text-gold-300"
                  >
                    {e.number}
                  </a>
                </li>
              ))}
            </ul>
          </Card>
          <Card depth="raised">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <CardTitle className="inline-flex items-center gap-2">
                  <MessageSquare aria-hidden className="h-5 w-5 text-gold-600" /> Survival phrases
                </CardTitle>
                {/* I5 — the phrases page reads the offline cache this
                    primer fetch just populated; works with no signal. */}
                <Link
                  href={`/trips/${tripId}/phrases` as never}
                  className="shrink-0 text-xs text-gold-600 underline-offset-4 transition hover:text-gold-700 hover:underline dark:hover:text-gold-300"
                >
                  Open offline →
                </Link>
              </div>
              <CardSubtitle>Tap a phrase to copy it.</CardSubtitle>
            </CardHeader>
            <ul className="space-y-2 text-sm">
              {primer.languagePhrases.map((p: LanguagePhraseDto) => (
                <li
                  key={`${p.english}:${p.translation}`}
                  className="rounded-2xl border border-gold-600/12 bg-surface p-4 shadow-(--shadow-depth-1) transition hover:border-gold-600/25"
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
                    className="block w-full rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-gold-500/25"
                  >
                    <p className="font-display font-semibold tracking-tight text-surface-foreground">
                      {p.translation}
                    </p>
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
