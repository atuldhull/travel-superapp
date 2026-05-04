/**
 * V.UX.32 — privacy hub. Three responsibilities:
 *
 *   1. Surface per-category storage stats from `/account/stats`
 *      ("We store: 24 trips, 130 photos, 8 reviews").
 *   2. Two export shortcuts: full JSON (`/account/export`) and
 *      streaming NDJSON (`/account/export.ndjson`). Both fetched
 *      with the access token + saved as a downloadable Blob.
 *   3. Three-step delete-my-account flow:
 *        a. "Have you exported your data?" → opens the export
 *           panel + requires explicit "Yes, I've exported" check.
 *        b. "Type your email to confirm." → free-text confirmation
 *           against an email-shape regex (we don't have the email
 *           in memory; the bearer token is the real auth gate).
 *        c. Final confirm dialog with destructive button.
 *
 * Auth-only client redirect; the api routes are owner-scoped.
 *
 * Installed by prompt [V.UX.32].
 */
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  useAccountControllerDeleteMyAccount,
  useAccountControllerStorageStats,
  type StorageStatsResponseDto,
} from '@app/sdk';
import { Button } from '../../../components/ui/button';
import { Card, CardHeader, CardSubtitle, CardTitle } from '../../../components/ui/card';
import { Field } from '../../../components/ui/input';
import { Skeleton } from '../../../components/ui/skeleton';
import { announce } from '../../../lib/announce';
import { clearAccessToken, getAccessToken } from '../../../lib/auth-store';
import { useAuthBootComplete, useAuthToken } from '../../../lib/use-auth-token';

interface ApiError extends Error {
  readonly code?: string;
  readonly status?: number;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CATEGORIES: ReadonlyArray<{ key: keyof StorageStatsResponseDto; label: string }> = [
  { key: 'trips', label: 'Active trips' },
  { key: 'tripsArchived', label: 'Archived trips' },
  { key: 'itineraryDays', label: 'Itinerary days' },
  { key: 'itineraryItems', label: 'Itinerary items' },
  { key: 'mediaAssets', label: 'Photos & videos' },
  { key: 'memoryBooks', label: 'Memory books' },
  { key: 'reviews', label: 'Reviews' },
  { key: 'votes', label: 'Trip votes' },
  { key: 'expenses', label: 'Expenses' },
  { key: 'helpfulVotes', label: 'Helpful votes cast' },
  { key: 'trustedContacts', label: 'Trusted contacts' },
  { key: 'notifications', label: 'Notifications received' },
  { key: 'pushSubscriptions', label: 'Push subscriptions' },
  { key: 'sosEvents', label: 'SOS events' },
  { key: 'scamReports', label: 'Scam reports' },
  { key: 'dishReports', label: 'Dish reports' },
  { key: 'oauthIdentities', label: 'Linked OAuth accounts' },
];

type DeleteStep = 'idle' | 'confirm-export' | 'confirm-email' | 'final-confirm';

export default function PrivacyHubPage() {
  const router = useRouter();
  const token = useAuthToken();
  const bootComplete = useAuthBootComplete();
  useEffect(() => {
    if (bootComplete && token === null) router.replace('/login');
  }, [bootComplete, token, router]);

  const stats = useAccountControllerStorageStats({
    query: { enabled: token !== null, retry: false },
  });
  const deleteAccount = useAccountControllerDeleteMyAccount();

  const [exporting, setExporting] = useState<'json' | 'ndjson' | null>(null);
  const [exportErr, setExportErr] = useState<string | null>(null);
  const [step, setStep] = useState<DeleteStep>('idle');
  const [exportedAck, setExportedAck] = useState(false);
  const [emailConfirm, setEmailConfirm] = useState('');
  const [deleteErr, setDeleteErr] = useState<string | null>(null);

  if (!bootComplete) return <p className="text-sm text-muted">Restoring your session…</p>;
  if (token === null) return <p className="text-sm text-muted">Redirecting to sign in…</p>;

  const body = stats.data?.data as StorageStatsResponseDto | undefined;

  async function downloadExport(kind: 'json' | 'ndjson') {
    setExportErr(null);
    setExporting(kind);
    try {
      const t = getAccessToken();
      const url = kind === 'json' ? '/api/v1/account/export' : '/api/v1/account/export.ndjson';
      const res = await fetch(url, {
        method: 'GET',
        headers: t ? { authorization: `Bearer ${t}` } : {},
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP_${res.status}`);
      const blob = await res.blob();
      const filename = kind === 'json' ? 'travel-export.json' : 'travel-export.ndjson';
      const a = document.createElement('a');
      const objectUrl = URL.createObjectURL(blob);
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
      announce(`Export downloaded as ${filename}`);
    } catch (err) {
      const e = err as ApiError;
      setExportErr(`${e.code ?? `HTTP_${e.status ?? '???'}`} — ${e.message ?? 'Export failed.'}`);
      announce('Export failed', 'assertive');
    } finally {
      setExporting(null);
    }
  }

  function startDelete() {
    setDeleteErr(null);
    setExportedAck(false);
    setEmailConfirm('');
    setStep('confirm-export');
  }

  function nextFromExport() {
    if (!exportedAck) {
      setDeleteErr('Confirm you have exported your data first.');
      return;
    }
    setDeleteErr(null);
    setStep('confirm-email');
  }

  function nextFromEmail() {
    if (!EMAIL_RE.test(emailConfirm.trim())) {
      setDeleteErr('Type the email address you registered with.');
      return;
    }
    setDeleteErr(null);
    setStep('final-confirm');
  }

  async function performDelete() {
    setDeleteErr(null);
    try {
      await deleteAccount.mutateAsync();
      announce('Account deleted. You will be signed out.', 'assertive');
      clearAccessToken();
      router.replace('/login');
    } catch (err) {
      const e = err as ApiError;
      setDeleteErr(`${e.code ?? `HTTP_${e.status ?? '???'}`} — ${e.message ?? 'Delete failed.'}`);
    }
  }

  function cancelDelete() {
    setStep('idle');
    setDeleteErr(null);
    setExportedAck(false);
    setEmailConfirm('');
  }

  return (
    <div className="space-y-6">
      <header>
        <p>
          <Link href={'/account' as never} className="text-sm text-muted hover:underline">
            ← Account
          </Link>
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Privacy & data</h1>
        <p className="mt-1 text-sm text-muted">See what we store, take a copy, or delete it all.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>What we store</CardTitle>
          <CardSubtitle>
            One row per category. Counts are cheap indexed scans — refreshed each visit.
          </CardSubtitle>
        </CardHeader>
        {stats.isLoading || !body ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {CATEGORIES.map((c) => (
              <li
                key={c.key}
                className="flex items-baseline justify-between gap-3 rounded border border-muted/15 px-3 py-2 text-sm"
              >
                <span className="text-muted">{c.label}</span>
                <span className="font-semibold tabular-nums">{body[c.key] as number}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Export your data</CardTitle>
          <CardSubtitle>
            Two formats: a single JSON object (easy for jq) or NDJSON (one envelope per line — ideal
            for streaming + large bundles).
          </CardSubtitle>
        </CardHeader>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => void downloadExport('json')}
            disabled={exporting !== null}
          >
            {exporting === 'json' ? 'Preparing…' : 'Download JSON'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void downloadExport('ndjson')}
            disabled={exporting !== null}
          >
            {exporting === 'ndjson' ? 'Preparing…' : 'Download NDJSON'}
          </Button>
        </div>
        {exportErr ? <p className="mt-2 text-xs text-danger">{exportErr}</p> : null}
      </Card>

      <Card className="border-danger/30">
        <CardHeader>
          <CardTitle>Delete my account</CardTitle>
          <CardSubtitle>
            Soft-delete now; the row is hard-deleted by the daily purger after 7 days. All trips,
            media, and notifications cascade.
          </CardSubtitle>
        </CardHeader>
        {step === 'idle' ? (
          <Button type="button" variant="outline" onClick={startDelete}>
            🗑 Delete my account
          </Button>
        ) : null}

        {step === 'confirm-export' ? (
          <div className="space-y-3">
            <p className="text-sm">
              <strong>Step 1 of 3.</strong> Have you exported your data? You won&apos;t be able to
              after.
            </p>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={exportedAck}
                onChange={(e) => setExportedAck(e.target.checked)}
              />
              <span>Yes, I&apos;ve exported (or I don&apos;t need a copy).</span>
            </label>
            {deleteErr ? <p className="text-xs text-danger">{deleteErr}</p> : null}
            <div className="flex gap-2">
              <Button type="button" onClick={nextFromExport}>
                Next
              </Button>
              <Button type="button" variant="ghost" onClick={cancelDelete}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}

        {step === 'confirm-email' ? (
          <div className="space-y-3">
            <p className="text-sm">
              <strong>Step 2 of 3.</strong> Type the email address you registered with.
            </p>
            <Field
              label="Email"
              type="email"
              autoComplete="email"
              value={emailConfirm}
              onChange={(e) => setEmailConfirm(e.target.value)}
            />
            {deleteErr ? <p className="text-xs text-danger">{deleteErr}</p> : null}
            <div className="flex gap-2">
              <Button type="button" onClick={nextFromEmail}>
                Next
              </Button>
              <Button type="button" variant="ghost" onClick={cancelDelete}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}

        {step === 'final-confirm' ? (
          <div className="space-y-3">
            <p className="text-sm">
              <strong>Step 3 of 3.</strong> Last chance. This soft-deletes your account immediately.
              The hard-delete sweep finalises in 7 days; sign in before then to undo.
            </p>
            {deleteErr ? <p className="text-xs text-danger">{deleteErr}</p> : null}
            <div className="flex gap-2">
              <Button
                type="button"
                onClick={() => void performDelete()}
                disabled={deleteAccount.isPending}
                className="bg-danger text-white hover:opacity-90"
              >
                {deleteAccount.isPending ? 'Deleting…' : 'Delete forever'}
              </Button>
              <Button type="button" variant="ghost" onClick={cancelDelete}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
