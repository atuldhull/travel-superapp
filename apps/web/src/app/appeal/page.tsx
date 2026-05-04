/**
 * V.UX.34 — ban appeal form. Unauthed (banned users can't sign in).
 * Pre-fills the email from `?email=...` (passed by /login when it
 * surfaces ACCOUNT_BANNED). Posts to `/account/appeal` which
 * silently 200s for unknown / non-banned emails — the user is told
 * the same "we'll review" message either way.
 *
 * Body must be 10..2000 chars (matches Zod). Soft rate-limit (3
 * appeals per email per hour) is enforced server-side.
 *
 * Installed by prompt [V.UX.34].
 */
'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useAccountControllerAppeal } from '@app/sdk';
import { Button } from '../../components/ui/button';
import { Card, CardHeader, CardSubtitle, CardTitle } from '../../components/ui/card';
import { Field } from '../../components/ui/input';
import { announce } from '../../lib/announce';

interface ApiError extends Error {
  readonly code?: string;
  readonly status?: number;
}

const BODY_MIN = 10;
const BODY_MAX = 2000;

export default function AppealPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
      <AppealInner />
    </Suspense>
  );
}

function AppealInner() {
  const params = useSearchParams();
  const [email, setEmail] = useState(params?.get('email') ?? '');
  const [body, setBody] = useState('');
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const submit = useAccountControllerAppeal();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrMsg(null);
    if (body.trim().length < BODY_MIN) {
      setErrMsg(`Tell us at least ${BODY_MIN} characters of context.`);
      return;
    }
    if (body.trim().length > BODY_MAX) {
      setErrMsg(`Keep your appeal under ${BODY_MAX} characters.`);
      return;
    }
    try {
      await submit.mutateAsync({ data: { email, body } });
      setSent(true);
      announce('Appeal submitted. We will review and get back to you.');
    } catch (err) {
      const e = err as ApiError;
      setErrMsg(`${e.code ?? `HTTP_${e.status ?? '???'}`} — ${e.message ?? 'Submit failed.'}`);
    }
  }

  return (
    <main className="space-y-6">
      <p>
        <Link href="/login" className="text-sm text-muted hover:underline">
          ← Back to sign-in
        </Link>
      </p>
      <h1 className="text-3xl font-bold tracking-tight">Appeal a suspension</h1>

      {sent ? (
        <Card className="border-emerald-500/40 bg-emerald-500/5">
          <CardHeader>
            <CardTitle>Got it — we&apos;ll review your appeal</CardTitle>
            <CardSubtitle>
              Every appeal is read by a person on our trust + safety team. We aim to respond within
              1–2 business days. If your account is reinstated you&apos;ll get a confirmation email
              + can sign in normally.
            </CardSubtitle>
          </CardHeader>
        </Card>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-muted">
            We never auto-respond — every word goes to a human reviewer. Please share specifics:
            what happened, why you think the suspension was a mistake, and any context that helps.
          </p>
          <Field
            label="Your email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            help="Use the address tied to the suspended account."
          />
          <label className="block space-y-1">
            <span className="block text-sm font-medium">Your side of the story</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              minLength={BODY_MIN}
              maxLength={BODY_MAX}
              rows={8}
              className="block w-full rounded-md border border-muted/30 bg-surface px-3 py-2 text-sm text-surface-foreground transition focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
              placeholder="Tell us what happened…"
            />
            <span className="block text-xs text-muted">
              {body.trim().length} / {BODY_MAX} characters · minimum {BODY_MIN}.
            </span>
          </label>
          {errMsg ? (
            <p className="rounded-md border border-danger/30 bg-danger/5 px-4 py-2 text-sm text-danger">
              {errMsg}
            </p>
          ) : null}
          <Button type="submit" disabled={submit.isPending}>
            {submit.isPending ? 'Sending…' : 'Submit appeal'}
          </Button>
        </form>
      )}
    </main>
  );
}
