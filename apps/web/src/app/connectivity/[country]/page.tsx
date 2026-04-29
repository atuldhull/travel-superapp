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
 * Installed by prompt [V.UX.23].
 */
'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useConnectivityControllerByCountry, type ConnectivityInfoDto } from '@app/sdk';
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
    <main className="space-y-6">
      <p>
        <Link href="/account/preferences" className="text-sm text-muted hover:underline">
          ← Back to preferences
        </Link>
      </p>
      <Card>
        <CardHeader>
          <CardTitle>📡 Connectivity — {country.toUpperCase()}</CardTitle>
          <CardSubtitle>
            Average mobile + fixed-line speeds, prepaid SIM cost, and power plug shape. Editorially
            seeded — six countries today, more coming.
          </CardSubtitle>
        </CardHeader>
        {isLoading ? (
          <Skeleton className="h-12 w-full" />
        ) : isError ? (
          <p className="text-sm text-danger">
            {missing
              ? `No connectivity info for "${country}" yet — we expand the editorial seed as we go.`
              : `Couldn't load connectivity info (${apiErr?.code ?? `HTTP_${apiErr?.status ?? '???'}`}).`}
          </p>
        ) : info ? (
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-muted">Country</dt>
            <dd className="font-medium">{info.countryName}</dd>
            <dt className="text-muted">📱 Mobile avg</dt>
            <dd className="font-mono">{info.avgMobileDownloadMbps} Mbps</dd>
            <dt className="text-muted">🌐 Fixed avg</dt>
            <dd className="font-mono">{info.avgFixedDownloadMbps} Mbps</dd>
            <dt className="text-muted">💳 Prepaid SIM (10 GB)</dt>
            <dd className="font-mono">${info.simCostUsd10Gb}</dd>
            <dt className="text-muted">📶 Best carrier</dt>
            <dd>{info.bestCarrier}</dd>
            <dt className="text-muted">🔌 Power plugs</dt>
            <dd className="flex flex-wrap gap-1">
              {info.powerPlugs.map((p) => (
                <span
                  key={p}
                  className="rounded-full border border-muted/20 bg-muted/10 px-2 py-0.5 text-xs"
                >
                  Type {p}
                </span>
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
