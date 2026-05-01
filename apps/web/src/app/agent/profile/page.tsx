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
    <main className="space-y-6">
      <p>
        <Link href="/agent/dashboard" className="text-sm text-muted hover:underline">
          ← Back to dashboard
        </Link>
      </p>
      <Card>
        <CardHeader>
          <CardTitle>✏️ Agent profile</CardTitle>
          <CardSubtitle>Edit displayName, bio, languages, and regions.</CardSubtitle>
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
          <form onSubmit={submit} className="space-y-3">
            {profile.kycStatus === 'verified' ? (
              <Badge variant="brand">✓ Verified</Badge>
            ) : (
              <Badge variant="neutral">{profile.kycStatus}</Badge>
            )}
            <Field label="Display name">
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={120}
                className="w-full rounded-md border border-muted/30 bg-transparent px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Bio">
              <textarea
                value={bioText}
                onChange={(e) => setBioText(e.target.value)}
                rows={4}
                maxLength={2000}
                placeholder="Tell travelers what makes you special…"
                className="w-full rounded-md border border-muted/30 bg-transparent px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Languages (comma-separated)">
              <input
                type="text"
                value={languagesText}
                onChange={(e) => setLanguagesText(e.target.value)}
                placeholder="en, pt, es"
                className="w-full rounded-md border border-muted/30 bg-transparent px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Regions you cover (comma-separated)">
              <input
                type="text"
                value={regionsText}
                onChange={(e) => setRegionsText(e.target.value)}
                placeholder="Lisbon, Porto, Sintra"
                className="w-full rounded-md border border-muted/30 bg-transparent px-3 py-2 text-sm"
              />
            </Field>
            {errMsg ? (
              <p className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
                {errMsg}
              </p>
            ) : null}
            {savedAt !== null ? (
              <p className="text-xs text-emerald-600 dark:text-emerald-400">
                ✓ Saved {new Date(savedAt).toLocaleTimeString()}
              </p>
            ) : null}
            <Button type="submit" variant="primary" disabled={update.isPending}>
              {update.isPending ? 'Saving…' : 'Save profile'}
            </Button>
          </form>
        ) : null}
      </Card>
    </main>
  );
}
