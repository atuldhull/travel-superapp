/**
 * V.UX.14 — caller's preferences page. Family-mode toggle + kid
 * ages live here; the same row is shared with diet / accessibility /
 * travel-type / budget-tier (so we don't have to grow N parallel
 * preferences pages). Once familyMode is on, search forms across
 * the app auto-add the family filter chips and the trip detail
 * page surfaces a pacing warning at > 4 items / day.
 *
 * Auth-gated (redirects to /login while booting). Uses the same
 * useAuthBootComplete + useAuthToken pattern as the rest of the
 * caller-self surfaces.
 *
 * Installed by prompt [V.UX.14].
 */
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getPreferencesControllerGetMineQueryKey,
  usePreferencesControllerGetMine,
  usePreferencesControllerUpdateMine,
  type PreferencesDto,
  type UpdatePreferencesRequestDto,
} from '@app/sdk';
import { Button } from '../../../components/ui/button';
import { Card, CardHeader, CardSubtitle, CardTitle } from '../../../components/ui/card';
import { Field } from '../../../components/ui/input';
import { Skeleton } from '../../../components/ui/skeleton';
import { useAuthBootComplete, useAuthToken } from '../../../lib/use-auth-token';

interface ApiError extends Error {
  readonly code?: string;
  readonly status?: number;
}

const MAX_KIDS = 8;

export default function PreferencesPage() {
  const router = useRouter();
  const token = useAuthToken();
  const bootComplete = useAuthBootComplete();
  const queryClient = useQueryClient();

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // Local edit buffer — initialised from the server snapshot, then
  // kept independent so the family-mode toggle can flip immediately
  // without waiting on a round-trip.
  const [familyMode, setFamilyMode] = useState(false);
  const [kidAgesText, setKidAgesText] = useState('');

  useEffect(() => {
    if (bootComplete && token === null) router.replace('/login');
  }, [bootComplete, token, router]);

  const { data, isLoading, isError, error } = usePreferencesControllerGetMine({
    query: { enabled: token !== null },
  });

  const prefs = data?.data as unknown as PreferencesDto | undefined;

  // Hydrate the local edit buffer once the server snapshot lands.
  useEffect(() => {
    if (!prefs) return;
    setFamilyMode(prefs.familyMode);
    setKidAgesText(prefs.kidAges.join(', '));
  }, [prefs]);

  async function refresh() {
    await queryClient.invalidateQueries({
      queryKey: getPreferencesControllerGetMineQueryKey(),
    });
  }

  const updateMutation = usePreferencesControllerUpdateMine({
    mutation: {
      onSuccess: async () => {
        await refresh();
        setErrorMsg(null);
        setSavedAt(Date.now());
      },
      onError: (err: unknown) => {
        const e = err as ApiError;
        setErrorMsg(`${e.code ?? `HTTP_${e.status ?? '???'}`} — ${e.message ?? 'Save failed.'}`);
      },
    },
  });

  const parsedAges = useMemo(() => parseAges(kidAgesText), [kidAgesText]);

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
  if (isLoading) {
    return (
      <main className="space-y-4">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </main>
    );
  }
  if (isError) {
    const e = error as ApiError;
    return (
      <main className="space-y-4">
        <p className="rounded-md border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          Couldn't load preferences ({e.code ?? `HTTP_${e.status ?? '???'}`}). {e.message ?? ''}
        </p>
      </main>
    );
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMsg(null);
    if (parsedAges === null) {
      setErrorMsg('Kid ages must be comma-separated integers 0..17.');
      return;
    }
    if (parsedAges.length > MAX_KIDS) {
      setErrorMsg(`Up to ${MAX_KIDS} kids.`);
      return;
    }
    const data: UpdatePreferencesRequestDto = {
      familyMode,
      kidAges: parsedAges,
    };
    updateMutation.mutate({ data });
  }

  return (
    <main className="space-y-6">
      <p>
        <Link href="/" className="text-sm text-muted hover:underline">
          ← Home
        </Link>
      </p>
      <Card>
        <CardHeader>
          <CardTitle>👨‍👩‍👧 Preferences</CardTitle>
          <CardSubtitle>
            Family mode flips search forms into kid-aware mode and warns when a day's pace gets too
            heavy. Everything else (diet / accessibility / budget) is editable elsewhere.
          </CardSubtitle>
        </CardHeader>
        <form onSubmit={submit} className="space-y-4">
          <label className="flex items-start gap-3 rounded-md border border-muted/15 bg-muted/5 p-3 text-sm">
            <input
              type="checkbox"
              checked={familyMode}
              onChange={(e) => setFamilyMode(e.target.checked)}
              className="mt-0.5 h-4 w-4"
            />
            <span>
              <span className="font-medium">Family mode</span>
              <span className="block text-xs text-muted">
                Auto-adds kid-friendly / stroller / high-chair / crib chips to search; pacing
                warning on heavy days.
              </span>
            </span>
          </label>
          <Field label="Kid ages (comma-separated, 0–17)">
            <input
              type="text"
              value={kidAgesText}
              onChange={(e) => setKidAgesText(e.target.value)}
              placeholder="e.g. 5, 8, 11"
              className="w-full rounded-md border border-muted/30 bg-transparent px-3 py-2 text-sm"
            />
          </Field>
          {errorMsg ? (
            <p className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
              {errorMsg}
            </p>
          ) : null}
          {savedAt !== null ? (
            <p className="text-xs text-emerald-600 dark:text-emerald-400">
              ✓ Saved {new Date(savedAt).toLocaleTimeString()}
            </p>
          ) : null}
          <Button type="submit" variant="primary" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? 'Saving…' : 'Save preferences'}
          </Button>
        </form>
      </Card>
      {prefs ? (
        <Card>
          <CardHeader>
            <CardTitle>Other preferences (read-only here)</CardTitle>
          </CardHeader>
          <dl className="grid grid-cols-2 gap-y-1 text-xs">
            <dt className="text-muted">Diet</dt>
            <dd>{prefs.diet.length > 0 ? prefs.diet.join(', ') : '—'}</dd>
            <dt className="text-muted">Accessibility</dt>
            <dd>{prefs.accessibility.length > 0 ? prefs.accessibility.join(', ') : '—'}</dd>
            <dt className="text-muted">Travel type</dt>
            <dd>{prefs.travelType.length > 0 ? prefs.travelType.join(', ') : '—'}</dd>
            <dt className="text-muted">Budget tier</dt>
            <dd>{prefs.budgetTier} / 5</dd>
          </dl>
        </Card>
      ) : null}
    </main>
  );
}

function parseAges(text: string): number[] | null {
  const trimmed = text.trim();
  if (trimmed.length === 0) return [];
  const parts = trimmed
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const out: number[] = [];
  for (const p of parts) {
    const n = Number(p);
    if (!Number.isInteger(n) || n < 0 || n > 17) return null;
    out.push(n);
  }
  return out;
}
