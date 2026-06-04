/**
 * V.UX.23 — connectivity-info page for the digital-nomad persona.
 *
 *   /connectivity/:country  →  avg mobile + fixed speeds, SIM cost,
 *                              best carrier, power plug shapes.
 *
 * Public — the api endpoint is `@Public()` (the seeded data has no
 * PII). 404 handling renders a friendly "no data yet" panel rather
 * than the generic error page.
 *
 * Installed by prompt [V.UX.23]; restyled into the v2 ("Fusion")
 * design language (royal/gold tokens, font-display, royal header band).
 */
'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Signal } from 'lucide-react';
import { useConnectivityControllerByCountry, type ConnectivityInfoDto } from '@app/sdk';
import { Badge } from '../../../components/ui/badge';
import { Card, CardHeader, CardSubtitle, CardTitle } from '../../../components/ui/card';
import { Skeleton } from '../../../components/ui/skeleton';

interface ApiError extends Error {
  readonly code?: string;
  readonly status?: number;
}

export default function ConnectivityPage() {
  const params = useParams<{ country: string }>();
  const country = (params?.country ?? '').toLowerCase();
  const { data, isLoading, isError, error } = useConnectivityControllerByCountry(country, {
    query: { enabled: country !== '', retry: false },
  });

  const apiErr = error as ApiError | null;
  const info = data?.data as unknown as ConnectivityInfoDto | undefined;
  const missing = apiErr?.status === 404;

  return (
    <main className="space-y-8">
      <Link
        href="/account/preferences"
        className="inline-flex items-center gap-1.5 text-sm text-muted underline-offset-4 transition hover:text-gold-600 hover:underline"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" /> Back to preferences
      </Link>

      {/* Cinematic royal header band — matches /stays + /trips. */}
      <header
        className="relative isolate overflow-hidden rounded-3xl border border-gold-600/20 px-6 py-8 shadow-(--shadow-depth-2) sm:px-10"
        style={{ backgroundImage: 'var(--gradient-royal)' }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-gold-500/20 blur-[110px]"
        />
        <p className="relative inline-flex items-center gap-2 rounded-full border border-gold-500/40 bg-white/5 px-3 py-1 text-xs font-medium tracking-wide text-gold-300 backdrop-blur-sm">
          <Signal aria-hidden className="h-3.5 w-3.5" /> Stay connected
        </p>
        <h1 className="relative mt-3 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          Connectivity — {country.toUpperCase()}
        </h1>
        <p className="relative mt-2 max-w-lg text-sm text-white/65">
          Average mobile + fixed-line speeds, prepaid SIM cost, and power plug shape. Editorially
          seeded — six countries today, more coming.
        </p>
      </header>

      <Card depth="raised">
        <CardHeader>
          <CardTitle className="font-display text-xl">At a glance</CardTitle>
          <CardSubtitle>
            What to expect on the ground before you book a SIM or pack an adapter.
          </CardSubtitle>
        </CardHeader>
        {isLoading ? (
          <Skeleton className="h-12 w-full" />
        ) : isError ? (
          <p className="rounded-2xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
            {missing
              ? `No connectivity info for "${country}" yet — we expand the editorial seed as we go.`
              : `Couldn't load connectivity info (${apiErr?.code ?? `HTTP_${apiErr?.status ?? '???'}`}).`}
          </p>
        ) : info ? (
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-muted">Country</dt>
            <dd className="font-medium text-surface-foreground">{info.countryName}</dd>
            <dt className="text-muted">📱 Mobile avg</dt>
            <dd className="font-mono text-surface-foreground">{info.avgMobileDownloadMbps} Mbps</dd>
            <dt className="text-muted">🌐 Fixed avg</dt>
            <dd className="font-mono text-surface-foreground">{info.avgFixedDownloadMbps} Mbps</dd>
            <dt className="text-muted">💳 Prepaid SIM (10 GB)</dt>
            <dd className="font-mono text-surface-foreground">${info.simCostUsd10Gb}</dd>
            <dt className="text-muted">📶 Best carrier</dt>
            <dd className="text-surface-foreground">{info.bestCarrier}</dd>
            <dt className="text-muted">🔌 Power plugs</dt>
            <dd className="flex flex-wrap gap-1">
              {info.powerPlugs.map((p) => (
                <Badge key={p} variant="gold">
                  Type {p}
                </Badge>
              ))}
            </dd>
          </dl>
        ) : null}
        {info ? (
          <p className="mt-3 text-[11px] text-muted">
            Editorial seed last refreshed {new Date(info.seededAt).toLocaleDateString()}.
          </p>
        ) : null}
      </Card>
    </main>
  );
}
