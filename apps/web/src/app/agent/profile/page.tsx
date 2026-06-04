/**
 * V.UX.24 — agent profile editor. PATCHes /agent/me with bio +
 * languages + regions + displayName. Editable fields only;
 * KYC status + verifiedAt + rating aggregates are read-only here
 * (admin-managed).
 *
 * Auth-gated. Non-agent role → friendly redirect message; missing
 * Agent row → the same provisioning copy the dashboard uses.
 *
 * Installed by prompt [V.UX.24].
 */
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, IdCard } from 'lucide-react';
import {
  getAgentSelfControllerMeQueryKey,
  useAgentSelfControllerMe,
  useAgentSelfControllerUpdate,
  type AgentProfileDto,
  type UpdateAgentProfileRequestDto,
} from '@app/sdk';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Card, CardHeader, CardSubtitle, CardTitle } from '../../../components/ui/card';
import { Field } from '../../../components/ui/input';
import { Skeleton } from '../../../components/ui/skeleton';
import { useAuthBootComplete, useAuthToken } from '../../../lib/use-auth-token';

interface ApiError extends Error {
  readonly code?: string;
  readonly status?: number;
}

export default function AgentProfilePage() {
  const router = useRouter();
  const token = useAuthToken();
  const bootComplete = useAuthBootComplete();
  const queryClient = useQueryClient();

  const [displayName, setDisplayName] = useState('');
  const [bioText, setBioText] = useState('');
  const [languagesText, setLanguagesText] = useState('');
  const [regionsText, setRegionsText] = useState('');
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (bootComplete && token === null) router.replace('/login');
  }, [bootComplete, token, router]);

  const { data, isLoading, isError, error } = useAgentSelfControllerMe({
    query: { enabled: token !== null, retry: false },
  });
  const profile = data?.data as unknown as AgentProfileDto | undefined;

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.displayName);
    setBioText((profile.bio as unknown as string | null) ?? '');
    setLanguagesText(profile.languages.join(', '));
    setRegionsText(profile.regions.join(', '));
  }, [profile]);

  const update = useAgentSelfControllerUpdate({
    mutation: {
      onSuccess: async () => {
        setErrMsg(null);
        setSavedAt(Date.now());
        await queryClient.invalidateQueries({ queryKey: getAgentSelfControllerMeQueryKey() });
      },
      onError: (err: unknown) => {
        const e = err as ApiError;
        setErrMsg(`${e.code ?? `HTTP_${e.status ?? '???'}`} — ${e.message ?? 'Save failed.'}`);
      },
    },
  });

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrMsg(null);
    setSavedAt(null);
    const langs = languagesText
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const regs = regionsText
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const data: UpdateAgentProfileRequestDto = {
      displayName: displayName.trim(),
      bio: (bioText.trim().length === 0
        ? null
        : bioText.trim()) as unknown as UpdateAgentProfileRequestDto['bio'],
      languages: langs,
      regions: regs,
    };
    update.mutate({ data });
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

  const apiErr = error as ApiError | null;
  const roleForbidden = apiErr?.code === 'ROLE_FORBIDDEN' || apiErr?.status === 403;
  const noProfile = apiErr?.code === 'AGENT_PROFILE_NOT_FOUND';

  return (
    <main className="space-y-8">
      <Link
        href="/agent/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-muted underline-offset-4 transition hover:text-gold-600 hover:underline"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" /> Back to dashboard
      </Link>

      {/* Cinematic royal header band — matches /trips + /account. */}
      <header
        className="relative isolate overflow-hidden rounded-3xl border border-gold-600/20 px-6 py-8 shadow-(--shadow-depth-2) sm:px-10"
        style={{ backgroundImage: 'var(--gradient-royal)' }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-gold-500/20 blur-[110px]"
        />
        <p className="relative inline-flex items-center gap-2 rounded-full border border-gold-500/40 bg-white/5 px-3 py-1 text-xs font-medium tracking-wide text-gold-300 backdrop-blur-sm">
          <IdCard aria-hidden className="h-3.5 w-3.5" /> Agent profile
        </p>
        <h1 className="relative mt-3 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          Your public profile
        </h1>
        <p className="relative mt-2 max-w-lg text-sm text-white/65">
          Edit your display name, bio, languages, and regions — travelers see this first.
        </p>
      </header>

      <Card depth="raised">
        <CardHeader>
          <CardTitle>Edit details</CardTitle>
          <CardSubtitle>
            KYC status, rating, and verification are admin-managed and read-only here.
          </CardSubtitle>
        </CardHeader>
        {isLoading ? (
          <Skeleton className="h-6 w-2/3" />
        ) : roleForbidden ? (
          <p className="text-sm text-danger">
            This page is for verified agents. If you believe you should have access, contact
            support.
          </p>
        ) : noProfile ? (
          <p className="text-sm text-muted">Your agent profile hasn&apos;t been provisioned yet.</p>
        ) : isError ? (
          <p className="text-sm text-danger">
            Couldn&apos;t load profile ({apiErr?.code ?? `HTTP_${apiErr?.status ?? '???'}`}).
          </p>
        ) : profile ? (
          <form onSubmit={submit} className="space-y-4">
            {profile.kycStatus === 'verified' ? (
              <Badge variant="success">✓ Verified</Badge>
            ) : (
              <Badge variant="neutral">{profile.kycStatus}</Badge>
            )}
            <Field label="Display name">
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={120}
                className="w-full rounded-lg border border-gold-600/25 bg-surface px-3 py-2 text-sm text-surface-foreground outline-none transition focus:border-gold-500 focus:ring-2 focus:ring-gold-500/25"
              />
            </Field>
            <Field label="Bio">
              <textarea
                value={bioText}
                onChange={(e) => setBioText(e.target.value)}
                rows={4}
                maxLength={2000}
                placeholder="Tell travelers what makes you special…"
                className="w-full rounded-lg border border-gold-600/25 bg-surface px-3 py-2 text-sm text-surface-foreground outline-none transition focus:border-gold-500 focus:ring-2 focus:ring-gold-500/25"
              />
            </Field>
            <Field label="Languages (comma-separated)">
              <input
                type="text"
                value={languagesText}
                onChange={(e) => setLanguagesText(e.target.value)}
                placeholder="en, pt, es"
                className="w-full rounded-lg border border-gold-600/25 bg-surface px-3 py-2 text-sm text-surface-foreground outline-none transition focus:border-gold-500 focus:ring-2 focus:ring-gold-500/25"
              />
            </Field>
            <Field label="Regions you cover (comma-separated)">
              <input
                type="text"
                value={regionsText}
                onChange={(e) => setRegionsText(e.target.value)}
                placeholder="Lisbon, Porto, Sintra"
                className="w-full rounded-lg border border-gold-600/25 bg-surface px-3 py-2 text-sm text-surface-foreground outline-none transition focus:border-gold-500 focus:ring-2 focus:ring-gold-500/25"
              />
            </Field>
            {errMsg ? (
              <p className="rounded-2xl border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
                {errMsg}
              </p>
            ) : null}
            {savedAt !== null ? (
              <p className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 aria-hidden className="h-3.5 w-3.5" /> Saved{' '}
                {new Date(savedAt).toLocaleTimeString()}
              </p>
            ) : null}
            <Button type="submit" variant="royal" disabled={update.isPending}>
              {update.isPending ? 'Saving…' : 'Save profile'}
            </Button>
          </form>
        ) : null}
      </Card>
    </main>
  );
}
