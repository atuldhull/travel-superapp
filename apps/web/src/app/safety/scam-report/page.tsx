/**
 * /safety/scam-report — file a crowd-sourced scam report.
 *
 * Closes C0's safety-40% gap (no public scam-report flow). The
 * `POST /api/v1/safety/scam` endpoint has been wired since the safety
 * module landed; this page is the user-facing surface that uses it.
 *
 * Auth-gated. Coordinates default to user geolocation; severity is a
 * four-bucket segmented control (low / medium / high / critical).
 * Evidence-URL field is optional (an attach-photo flow can hang off the
 * media-uploader later — keep this slice tight).
 *
 * Installed by [S-Csr] of the S-series real-functionality closeout.
 */
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, MapPin, ShieldAlert } from 'lucide-react';
import { useSafetyControllerReport, type ReportScamRequestDto } from '@app/sdk';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Card, CardHeader, CardSubtitle, CardTitle } from '../../../components/ui/card';
import { useAuthBootComplete, useAuthToken } from '../../../lib/use-auth-token';

// Mirror of the SDK schema enum (orval emits `*const` but the barrel
// re-exports types only — same pattern as /reviews/new + /transport).
type Severity = 'low' | 'medium' | 'high' | 'critical';

const SEVERITY_LABELS: Record<Severity, string> = {
  low: 'Low (annoying but harmless)',
  medium: 'Medium (lost money / time)',
  high: 'High (physical risk)',
  critical: 'Critical (life-threatening)',
};

// Traffic-light severity ramp stays semantic (medium→amber, high→orange,
// critical→red); only the neutral `low` bucket adopts gold tokens.
const SEVERITY_TONE: Record<Severity, string> = {
  low: 'border-gold-600/25 bg-gold-500/5 text-surface-foreground',
  medium: 'border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-300',
  high: 'border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-300',
  critical: 'border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400',
};

// Common scam categories — admin can vet and tag later. Free-form input
// is allowed (the API accepts any non-empty string).
const SUGGESTED_CATEGORIES: readonly string[] = [
  'taxi-overcharge',
  'fake-temple',
  'fake-tour-guide',
  'fake-police',
  'fake-monk',
  'shop-bait-switch',
  'pickpocket',
  'card-skimmer',
  'menu-price-swap',
  'aggressive-touts',
  'overpriced-souvenir',
  'spiked-drink',
  'fake-charity',
  'gem-import-scam',
];

interface ApiError extends Error {
  readonly code?: string;
  readonly status?: number;
}

export default function ScamReportPage() {
  const router = useRouter();
  const token = useAuthToken();
  const bootComplete = useAuthBootComplete();
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [coordsText, setCoordsText] = useState('');
  const [category, setCategory] = useState('');
  const [severity, setSeverity] = useState<Severity>('medium');
  const [description, setDescription] = useState('');
  const [evidenceUrlsText, setEvidenceUrlsText] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (bootComplete && token === null) router.replace('/login?next=/safety/scam-report');
  }, [bootComplete, token, router]);

  const submit = useSafetyControllerReport({
    mutation: {
      onSuccess: () => {
        setSubmitted(true);
        setErrorMsg(null);
      },
      onError: (err: unknown) => {
        const e = err as ApiError;
        setErrorMsg(
          `${e.code ?? `HTTP_${e.status ?? '???'}`} — ${e.message ?? 'Could not submit report.'}`,
        );
      },
    },
  });

  function useMyLocation() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCenter(c);
        setCoordsText(`${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}`);
      },
      () => setErrorMsg('Geolocation denied. Paste coordinates manually.'),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    );
  }

  function parseCoords(s: string): { lat: number; lng: number } | null {
    const parts = s.split(',').map((p) => Number(p.trim()));
    if (parts.length !== 2 || parts.some((n) => !Number.isFinite(n))) return null;
    const [lat, lng] = parts;
    if (lat! < -90 || lat! > 90 || lng! < -180 || lng! > 180) return null;
    return { lat: lat!, lng: lng! };
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMsg(null);
    const parsed = center ?? parseCoords(coordsText);
    if (!parsed) {
      setErrorMsg('Provide a location (use My Location or paste "lat, lng").');
      return;
    }
    if (!category.trim()) {
      setErrorMsg('Pick or enter a category.');
      return;
    }
    if (description.trim().length < 20) {
      setErrorMsg('Describe what happened in at least 20 characters.');
      return;
    }
    const evidenceUrls = evidenceUrlsText
      .split('\n')
      .map((u) => u.trim())
      .filter((u) => u.length > 0 && /^https?:\/\//i.test(u));
    const data: ReportScamRequestDto = {
      category: category.trim(),
      severity: severity as ReportScamRequestDto['severity'],
      center: parsed,
      description: description.trim(),
      ...(evidenceUrls.length > 0 ? { evidenceUrls } : {}),
    };
    submit.mutate({ data });
  }

  if (!bootComplete)
    return (
      <main>
        <p className="text-muted">Restoring session…</p>
      </main>
    );
  if (token === null)
    return (
      <main>
        <p className="text-muted">Redirecting to sign in…</p>
      </main>
    );

  if (submitted) {
    return (
      <main className="space-y-8">
        <Card depth="raised">
          <CardHeader>
            <CardTitle className="font-display">Report submitted 🙏</CardTitle>
            <CardSubtitle>
              Your report is queued for admin moderation. Verified reports surface on the public
              scam map; dismissed reports are deleted.
            </CardSubtitle>
          </CardHeader>
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="royal"
              onClick={() => {
                setSubmitted(false);
                setDescription('');
                setEvidenceUrlsText('');
              }}
            >
              File another
            </Button>
            <Link
              href="/trips"
              className="inline-flex items-center gap-1.5 rounded-full border border-gold-600/30 px-5 py-2.5 text-sm font-semibold text-surface-foreground transition hover:bg-gold-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Back to trips
            </Link>
          </div>
        </Card>
      </main>
    );
  }

  return (
    <main className="space-y-8">
      <Link
        href="/trips"
        className="inline-flex items-center gap-1.5 text-sm text-muted underline-offset-4 transition hover:text-gold-600 hover:underline"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" /> Back to trips
      </Link>

      {/* Cinematic royal header band — matches /trips + /stays + /account. */}
      <header
        className="relative isolate overflow-hidden rounded-3xl border border-gold-600/20 px-6 py-8 shadow-(--shadow-depth-2) sm:px-10"
        style={{ backgroundImage: 'var(--gradient-royal)' }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-gold-500/20 blur-[110px]"
        />
        <p className="relative inline-flex items-center gap-2 rounded-full border border-gold-500/40 bg-white/5 px-3 py-1 text-xs font-medium tracking-wide text-gold-300 backdrop-blur-sm">
          <ShieldAlert aria-hidden className="h-3.5 w-3.5" /> Keep travellers safe
        </p>
        <h1 className="relative mt-3 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          Report a scam
        </h1>
        <p className="relative mt-2 max-w-lg text-sm text-white/65">
          Help fellow travellers. Reports go to admin moderation; verified ones surface on the
          public scam map. Honest reports build the network — empty or hostile reports get
          dismissed.
        </p>
      </header>

      <Card depth="raised">
        <CardHeader>
          <CardTitle className="font-display">What happened?</CardTitle>
          <CardSubtitle>
            Pick the category that best fits, set the severity honestly, describe the scam.
          </CardSubtitle>
        </CardHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <p className="mb-1 text-sm font-medium">Location</p>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={useMyLocation}>
                <MapPin aria-hidden className="mr-1.5 h-3.5 w-3.5" /> Use my location
              </Button>
              <input
                type="text"
                value={coordsText}
                onChange={(e) => {
                  setCoordsText(e.target.value);
                  setCenter(null);
                }}
                placeholder="lat, lng"
                className="rounded-lg border border-gold-600/25 bg-surface px-3 py-2 font-mono text-xs text-surface-foreground outline-none transition focus:border-gold-500 focus:ring-2 focus:ring-gold-500/25"
              />
            </div>
          </div>

          <div>
            <p className="mb-1 text-sm font-medium">Category</p>
            <div className="flex flex-wrap gap-1">
              {SUGGESTED_CATEGORIES.map((c) => {
                const active = category === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategory(c)}
                    aria-pressed={active}
                    className={
                      'rounded-full border px-3 py-1 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ' +
                      (active
                        ? 'border-gold-600/40 bg-gold-500/15 text-gold-700 dark:text-gold-300'
                        : 'border-gold-600/25 text-muted hover:border-gold-600/40 hover:bg-gold-500/10')
                    }
                  >
                    {c}
                  </button>
                );
              })}
            </div>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="…or type a custom category"
              maxLength={64}
              className="mt-2 w-full max-w-sm rounded-lg border border-gold-600/25 bg-surface px-3 py-2 text-xs text-surface-foreground outline-none transition focus:border-gold-500 focus:ring-2 focus:ring-gold-500/25"
            />
          </div>

          <div>
            <p className="mb-1 text-sm font-medium">Severity</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {(Object.keys(SEVERITY_LABELS) as Severity[]).map((s) => {
                const active = severity === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSeverity(s)}
                    aria-pressed={active}
                    className={
                      'rounded-2xl border px-3 py-2 text-left text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ' +
                      (active
                        ? SEVERITY_TONE[s] + ' shadow-(--shadow-depth-1)'
                        : 'border-gold-600/25 text-muted hover:border-gold-600/40 hover:bg-gold-500/10')
                    }
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="capitalize">{s}</span>
                      {active ? <Badge variant="gold">selected</Badge> : null}
                    </div>
                    <p className="mt-0.5 text-[11px] font-normal text-muted">
                      {SEVERITY_LABELS[s]}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label htmlFor="scam-desc" className="block text-sm font-medium">
              What happened?
            </label>
            <textarea
              id="scam-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={6}
              minLength={20}
              maxLength={4000}
              required
              placeholder="Be specific: which street, time of day, what they did, how you got out, costs incurred."
              className="mt-1 w-full rounded-lg border border-gold-600/25 bg-surface px-3 py-2 text-sm text-surface-foreground outline-none transition focus:border-gold-500 focus:ring-2 focus:ring-gold-500/25"
            />
            <p className="mt-1 text-xs text-muted">
              {description.trim().length} / 4000 · minimum 20
            </p>
          </div>

          <div>
            <label htmlFor="scam-evidence" className="block text-sm font-medium">
              Evidence URLs (optional, one per line)
            </label>
            <textarea
              id="scam-evidence"
              value={evidenceUrlsText}
              onChange={(e) => setEvidenceUrlsText(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-gold-600/25 bg-surface px-3 py-2 font-mono text-xs text-surface-foreground outline-none transition focus:border-gold-500 focus:ring-2 focus:ring-gold-500/25"
              placeholder="https://…"
            />
            <p className="mt-1 text-xs text-muted">
              Upload photos elsewhere (e.g. memory book), then paste URLs here. Each line must start
              http(s):// — others are dropped.
            </p>
          </div>

          {errorMsg ? (
            <p className="rounded-2xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
              {errorMsg}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Button type="submit" variant="royal" disabled={submit.isPending}>
              {submit.isPending ? 'Submitting…' : 'Submit report'}
            </Button>
            <Link
              href="/trips"
              className="inline-flex items-center gap-1.5 rounded-full border border-gold-600/30 px-5 py-2.5 text-sm font-semibold text-surface-foreground transition hover:bg-gold-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Cancel
            </Link>
          </div>
        </form>
      </Card>
    </main>
  );
}
