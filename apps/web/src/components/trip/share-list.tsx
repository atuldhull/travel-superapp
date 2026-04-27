/**
 * V.UX.8 group-organiser share list. Lists every active share-code
 * the owner has minted, lets them mint a new one, copy/whatsapp the
 * shareable URL, and revoke obsolete codes.
 *
 * Owner-only — `useTripControllerListShares` 404s for non-owners,
 * which the parent gates by passing `enabled` based on ownership of
 * the trip in question.
 *
 * Installed by prompt [V.UX.8].
 */
'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getTripControllerListSharesQueryKey,
  useTripControllerListShares,
  useTripControllerRevokeShare,
  useTripControllerShare,
  type CreateTripShareRequestDto,
  type ListTripSharesResponseDto,
  type TripShareOwnerDto,
} from '@app/sdk';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardHeader, CardSubtitle, CardTitle } from '../ui/card';

interface ShareListProps {
  readonly tripId: string;
  readonly enabled: boolean;
}

type ShareRow = TripShareOwnerDto;

export function ShareList({ tripId, enabled }: ShareListProps) {
  const queryClient = useQueryClient();
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const { data, isLoading, isError } = useTripControllerListShares(tripId, {
    query: { enabled },
  });

  const mintMutation = useTripControllerShare({
    mutation: {
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: getTripControllerListSharesQueryKey(tripId),
        });
        setErrMsg(null);
      },
      onError: (err: unknown) => {
        const e = err as { code?: string; message?: string; status?: number };
        setErrMsg(`${e.code ?? `HTTP_${e.status ?? '???'}`} — ${e.message ?? 'Mint failed.'}`);
      },
    },
  });

  const revokeMutation = useTripControllerRevokeShare({
    mutation: {
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: getTripControllerListSharesQueryKey(tripId),
        });
      },
      onError: (err: unknown) => {
        const e = err as { code?: string; message?: string; status?: number };
        setErrMsg(`${e.code ?? `HTTP_${e.status ?? '???'}`} — ${e.message ?? 'Revoke failed.'}`);
      },
    },
  });

  if (!enabled) return null;

  const shares: readonly ShareRow[] =
    (data?.data as unknown as ListTripSharesResponseDto | undefined)?.shares ?? [];
  const active = shares.filter((s) => s.publicRead);

  function shareUrlFor(code: string): string {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/shared/${code}`;
  }

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(shareUrlFor(code));
      setCopied(code);
      window.setTimeout(() => setCopied((c) => (c === code ? null : c)), 2000);
    } catch {
      // Silent — user can long-press the URL text.
    }
  }

  function whatsappHref(code: string): string {
    const url = shareUrlFor(code);
    const text = `Join my trip plan: ${url}`;
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle>Shareable links</CardTitle>
            <CardSubtitle>
              Mint a code, send it via WhatsApp or copy. Revoke any code anytime.
            </CardSubtitle>
          </div>
          <Button
            type="button"
            size="sm"
            disabled={mintMutation.isPending}
            onClick={() => {
              const data: CreateTripShareRequestDto = {};
              mintMutation.mutate({ id: tripId, data });
            }}
          >
            {mintMutation.isPending ? 'Minting…' : '+ New code'}
          </Button>
        </div>
      </CardHeader>

      {errMsg ? (
        <p className="mb-2 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
          {errMsg}
        </p>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-muted">Loading shares…</p>
      ) : isError ? (
        <p className="text-sm text-danger">Couldn't load shares.</p>
      ) : active.length === 0 ? (
        <p className="text-sm text-muted">
          No active shares. Click <strong>+ New code</strong> to mint one.
        </p>
      ) : (
        <ul className="space-y-2">
          {active.map((s) => {
            const code = s.shareCode;
            const url = shareUrlFor(code);
            return (
              <li key={s.id} className="rounded border border-muted/15 bg-surface p-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <code className="break-all rounded bg-muted/10 px-2 py-1 font-mono text-[11px]">
                    {url}
                  </code>
                  <Badge variant="brand">active</Badge>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => copy(code)}>
                    {copied === code ? 'Copied!' : 'Copy URL'}
                  </Button>
                  <a
                    href={whatsappHref(code)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 px-3 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-500/10 dark:text-emerald-400"
                  >
                    💬 WhatsApp
                  </a>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={revokeMutation.isPending}
                    onClick={() => revokeMutation.mutate({ id: tripId, code })}
                  >
                    Revoke
                  </Button>
                  <span className="ml-auto text-[10px] text-muted">
                    Minted {new Date(s.createdAt).toLocaleString()}
                    {s.expiresAt
                      ? ` · expires ${new Date(s.expiresAt as unknown as string).toLocaleDateString()}`
                      : ''}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
